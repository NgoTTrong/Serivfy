import { prisma } from "./prisma";

/**
 * Fire-and-forget tenant audit writer. Callers never await the returned
 * promise in the happy path — a failing audit write should not surface to
 * the user. Errors are swallowed and optionally surfaced to structured logs.
 */
export async function tenantAudit(params: {
  restaurantId: string;
  actor?: { id: string; name: string } | null;
  action: string;
  target?: string | null;
  meta?: unknown;
}): Promise<void> {
  try {
    await prisma.tenantAuditLog.create({
      data: {
        restaurantId: params.restaurantId,
        actorStaffId: params.actor?.id ?? null,
        actorName: params.actor?.name ?? null,
        action: params.action,
        target: params.target ?? null,
        meta: params.meta != null ? JSON.stringify(params.meta) : null,
      },
    });
  } catch {
    /* swallow — audit must never break the caller */
  }
}
