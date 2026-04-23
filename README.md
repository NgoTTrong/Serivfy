# Servify

> **Quét. Chọn. Thưởng thức.**
> QR-based table ordering SaaS cho nhà hàng Việt.

Khách hàng quét QR dán trên bàn → vào menu ngay (không app, không tài khoản) → giỏ hàng chung realtime toàn bàn → bếp nhận đơn qua KDS → nhân viên tick từng món đã mang ra → chủ quán đóng bàn khi khách trả tiền.

**Thanh toán offline** (tiền mặt / chuyển khoản tại quán). Không tích hợp cổng thanh toán online.

---

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** (amber/orange brand tone)
- **Prisma** ORM — SQLite cho dev, đổi sang Postgres cho prod
- **bcryptjs + jose** — cookie JWT staff auth (không cần NextAuth)
- **qrcode** — generate QR PNG/SVG
- **Realtime**: polling 2–4s (có thể swap sang Supabase Realtime nếu muốn)

---

## Chạy local

```bash
# 1. Cài deps
npm install

# 2. Tạo DB + seed data
npx prisma db push
npm run db:seed

# 3. Chạy dev server
npm run dev
```

Mở http://localhost:3000

### Tài khoản demo

| Vai trò   | Email              | Mật khẩu |
| --------- | ------------------ | -------- |
| Admin     | admin@test.com     | 123456   |
| Waiter    | waiter@test.com    | 123456   |
| Kitchen   | kitchen@test.com   | 123456   |

### Link demo quan trọng

- Landing page: `/`
- Customer (Bàn 1): `/table/qr_ban_1_quan-ba-noi`
- Kitchen Display: `/kitchen/<restaurantId>` (auto redirect sau login)
- Waiter tablet: `/waiter/<restaurantId>`
- Admin dashboard: `/admin/<restaurantId>/dashboard`
- Login: `/admin/login`

---

## Cấu trúc

```
src/
  app/
    page.tsx                          — Servify landing page
    admin/login/                      — Staff login
    admin/[restaurantId]/             — Admin dashboard/menu/tables/staff
    waiter/[restaurantId]/            — Waiter tablet
    kitchen/[restaurantId]/           — Kitchen Display (read-only)
    table/[qrToken]/                  — QR entry — redirect vào session
    session/[token]/                  — Customer menu + cart + status
    api/                              — REST API routes
  lib/
    prisma.ts / auth.ts / format.ts / device.ts / session-guard.ts
prisma/
  schema.prisma                       — Đổi provider sang postgresql cho prod
  seed.ts                             — Quán Bà Nội demo data
```

---

## Swap sang Postgres (prod)

1. `prisma/schema.prisma` → đổi `provider = "sqlite"` → `provider = "postgresql"`
2. Set `DATABASE_URL` = Postgres connection string (Supabase / Neon / vv)
3. `npx prisma migrate deploy` (thay vì `db push`)
4. Vercel env vars: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`

### Bật realtime thực sự (Supabase)

Polling hiện tại hoạt động tốt — khi muốn push realtime:

1. Tạo Supabase project + dán Postgres URL vào `DATABASE_URL`
2. Bật Realtime cho `CartItem` và `OrderRound`
3. Thay `setInterval(load, N)` trong `CustomerApp.tsx`, `KitchenScreen.tsx`, `WaiterApp.tsx` bằng `supabase.channel(...).on(...)`

---

## Flow

### Session lifecycle
```
Table (qrToken cố định) ──┐
                          ▼
             Khách quét → /table/[qrToken]
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
  Có session ACTIVE?                Không có
  → nối vào session đó           → tạo session mới
                          │
                          ▼
                /session/[sessionToken]
                (Customer App — menu/cart/status)

Nhân viên bấm Đóng bàn → session.status = CLOSED
Lần quét tiếp theo tạo session mới.
```

### Gửi Order
```
cart items (all guests, shared) →
  tạo OrderRound(roundNumber = max+1, status = IN_KITCHEN) →
  move cart items vào round →
  clear cart → KDS nhận qua polling
```

### Xác nhận từng món
```
Waiter tick → servedQty += 1
Khi mọi item trong round có servedQty = quantity → round tự chuyển SERVED
Khách nhìn thấy ✓ ngay ở trang Đơn hàng
```

---

## Scripts

```bash
npm run dev          # Dev server
npm run build        # Build (tự chạy prisma generate)
npm run start        # Production server
npm run db:push      # Sync schema
npm run db:seed      # Seed demo data
npm run db:studio    # Prisma Studio
npm run db:reset     # Reset + re-seed
```
