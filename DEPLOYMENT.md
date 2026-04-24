# Servify — Production Deployment Checklist

## 1. Prerequisites

- [ ] Supabase Postgres (or equivalent Postgres with pooler)
- [ ] Vercel account (Fluid Compute enabled by default)
- [ ] Domain pointed to Vercel (e.g. `servify.vn`)
- [ ] (Optional) Casso account per tenant for payment reconciliation
- [ ] (Optional) E-invoice provider account (Viettel / VNPT / Misa / EasyInvoice / Hilo)

## 2. Environment variables (Vercel → Project → Settings → Env)

| Key | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase pooled URL (port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | ✅ | Supabase direct URL (port 5432) — used for migrations + advisory locks |
| `AUTH_SECRET` | ✅ | 32+ char random string. **Regenerate for prod** |
| `NEXT_PUBLIC_APP_URL` | ✅ | e.g. `https://servify.vn` — used for QR generation |

Generate `AUTH_SECRET`:
```bash
openssl rand -base64 48
```

## 3. Database migration

```bash
# One-time: apply all migrations
npx prisma migrate deploy

# Seed a platform admin to log into /superadmin (first deploy only)
npx tsx prisma/seed.ts
```

Migration list (in order):
1. `20260423010948_init`
2. `20260424120000_hardening` — tokenVersion, soft-delete, partial unique indexes, pulse + rate-limit
3. `20260424130000_printer` — PrintAgent / Printer / Station
4. `20260424140000_pos_guest_unique` — Guest (session, device) unique
5. `20260424150000_shift` — Shift + movement ledger
6. `20260424160000_voucher` — Voucher + VoucherRedemption
7. `20260424170000_audit_casso` — TenantAuditLog + BankTransaction
8. `20260424180000_einvoice` — EInvoiceConfig + EInvoice
9. `20260424190000_branch` — Branch + branchId on Staff/Table/Session (auto-backfill default branch per tenant)
10. `20260424200000_polish` — partial unique receipt number per tenant

## 4. Post-deploy smoke test

- [ ] `GET /api/health` → 200 with `{ status: "ok" }`
- [ ] `/signup` loads; can submit a restaurant signup
- [ ] Approve signup in `/superadmin/requests` → creates restaurant + admin + sample data
- [ ] Login as admin → dashboard loads
- [ ] QR customer flow: visit `/table/<qrToken>` → menu visible → add item → order submitted
- [ ] Staff: tick item served in waiter app
- [ ] Close bill → print popup opens → VietQR on receipt (if bank info set)
- [ ] Open shift → close bill → cash movement recorded
- [ ] Apply voucher → discount reflected on bill + analytics
- [ ] Casso webhook: `curl -H "Secure-Token: <token>" -d '...' <url>` → 200
- [ ] E-invoice STUB provider: close bill with e-invoice enabled → `ISSUED` status

## 5. Monitoring + ops

- [ ] Set up uptime monitor hitting `/api/health` every 1 min (UptimeRobot free tier)
- [ ] Vercel → Logs → set retention (Pro plan) or stream to Axiom / Better Stack
- [ ] Configure alerts: `error.severity=critical` or route 5xx spike
- [ ] Supabase backup: PITR enabled (default on Free tier)

## 6. Security hardening

- [ ] Rotate `AUTH_SECRET` for prod (don't reuse dev value)
- [ ] Cassowebhook secret: rotated per tenant via admin UI (not env)
- [ ] E-invoice credentials stored in DB — should be encrypted at rest via Postgres TDE / pgcrypto (TODO: not yet implemented)
- [ ] Review response time for `/api/health` — if DB latency > 1s, investigate pooler config

## 7. Known deferred items (by design)

- **Print Agent** (Windows tray app) — browser print popup is the default; Agent ships later as an optional install for restaurants that want auto-print
- **Real e-invoice provider** — STUB provider is the default until a tenant onboards with Viettel/VNPT/Misa; provider interface is in place
- **Multi-branch (chain)** — `branchId` columns are reserved in schema; logic for cross-branch reports + branch-scoped staff is pending
- **Inventory / stock** — intentionally skipped; recommend integrating KiotViet/Sapo for inventory-heavy restaurants
- **Full i18n** — Vietnamese only; English translation can ship later

## 8. Scaling checklist (when crossing ~100 restaurants)

- [ ] Move `RateLimit` table to Upstash Redis (Postgres UPSERT starts getting hot)
- [ ] Evaluate Postgres upgrade (Supabase Pro) — current free tier caps at 500MB
- [ ] Move `RestaurantPulse` counter to Redis if SSE poller load pressures DB
- [ ] Consider Vercel Pro plan for longer function durations (>300s) if SSE clients need to stay connected longer
- [ ] Implement Postgres LISTEN/NOTIFY broadcast (via `DIRECT_URL`) to eliminate per-instance SSE polling
