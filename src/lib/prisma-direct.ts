import { PrismaClient } from "@prisma/client";

// Separate PrismaClient that connects via DIRECT_URL (bypasses pgbouncer).
// Use only for long-running interactive $transaction flows (e.g. restaurant
// approval + sample seed). Pgbouncer in transaction-pooling mode cannot
// reliably hold a multi-statement interactive transaction open for >5s,
// causing "Transaction not found" errors.

const globalForDirect = globalThis as unknown as { prismaDirect?: PrismaClient };

const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export const prismaDirect =
  globalForDirect.prismaDirect ??
  new PrismaClient({
    datasources: { db: { url: directUrl } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForDirect.prismaDirect = prismaDirect;
