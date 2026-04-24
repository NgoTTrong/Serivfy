import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchTransactionToSession } from "@/lib/casso-match";
import { bumpPulse } from "@/lib/pulse";

export const dynamic = "force-dynamic";

/**
 * Casso payment-reconciliation webhook.
 *
 * Security: the tenant configures a shared secret in Servify settings. Casso
 * includes it in the `Secure-Token` header on every POST. We compare in
 * constant time and refuse mismatches.
 *
 * Idempotency: transactions are keyed by (provider, providerTxId). Replays
 * upsert into the same row without double-crediting.
 *
 * Matching: descriptions that contain our receipt number (SVF-...) match
 * a session by number + amount tolerance. Ambiguous matches are stored
 * with matchStatus=AMBIGUOUS for admin manual reconciliation.
 */

type CassoTx = {
  id: number | string;
  tid?: string;
  description?: string;
  amount?: number;
  when?: string;
  bankAbbreviation?: string;
  bankName?: string;
  corresponsiveName?: string;
};

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest, { params }: { params: { restaurantId: string } }) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: params.restaurantId },
    select: { id: true, cassoWebhookSecret: true, status: true },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (!restaurant.cassoWebhookSecret) {
    return NextResponse.json({ error: "CASSO_DISABLED" }, { status: 403 });
  }
  if (restaurant.status !== "ACTIVE") {
    return NextResponse.json({ error: "TENANT_INACTIVE" }, { status: 403 });
  }

  const token = req.headers.get("secure-token") ?? "";
  if (!timingSafeEq(token, restaurant.cassoWebhookSecret)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { data?: CassoTx[]; error?: number }
    | null;
  if (!body || !Array.isArray(body.data)) {
    return NextResponse.json({ error: "BAD_PAYLOAD" }, { status: 400 });
  }

  let processed = 0;
  for (const tx of body.data) {
    const providerTxId = String(tx.tid ?? tx.id ?? "");
    const amount = Number(tx.amount ?? 0);
    const description = String(tx.description ?? "");
    if (!providerTxId || !amount || amount <= 0) continue;

    // Idempotent insert.
    const existing = await prisma.bankTransaction.findUnique({
      where: { provider_providerTxId: { provider: "CASSO", providerTxId } },
    });
    if (existing) continue;

    const match = await matchTransactionToSession({
      restaurantId: restaurant.id,
      amount,
      description,
    });

    await prisma.bankTransaction.create({
      data: {
        restaurantId: restaurant.id,
        provider: "CASSO",
        providerTxId,
        amount,
        description,
        bankAbbr: tx.bankAbbreviation ?? tx.bankName ?? null,
        counterparty: tx.corresponsiveName ?? null,
        receivedAt: tx.when ? new Date(tx.when) : new Date(),
        rawPayload: JSON.stringify(tx),
        matchStatus: match.status,
        matchedSessionId: match.sessionId,
      },
    });

    // Auto-close the session if we have a confident match and the session
    // hasn't been closed yet (customer paid before staff confirmed).
    if (match.status === "MATCHED" && match.sessionId) {
      const session = await prisma.tableSession.findUnique({
        where: { id: match.sessionId },
        select: { status: true, receiptNumber: true },
      });
      if (session && session.status === "ACTIVE") {
        const now = new Date();
        await prisma.tableSession.update({
          where: { id: match.sessionId },
          data: {
            status: "CLOSED",
            closedAt: now,
            billRequestedAt: null,
            paymentMethod: "BANK_TRANSFER",
            paidAmount: amount,
            paidAt: now,
          },
        });
      }
    }

    processed += 1;
  }

  await bumpPulse(restaurant.id, ["tables", "customer"]);
  return NextResponse.json({ ok: true, processed });
}
