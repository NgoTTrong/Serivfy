import type { StaffSession } from "./auth";

/**
 * Build a Prisma where-clause scoped to the staff's branch, or unscoped
 * for HQ staff (branchId == null).
 *
 * Intended for `table`, `tableSession`, and related models that carry a
 * `branchId` column. Menu items, vouchers, stations, printers, etc. are
 * intentionally NOT scoped — they're tenant-wide resources.
 *
 * When `staff.branchId` is null we return an empty filter (HQ sees all).
 * When set, we filter by exact match OR null so legacy rows (pre-
 * migration) remain visible to everyone until they're reclassified.
 */
export function branchWhere(staff: StaffSession): {
  OR?: Array<{ branchId: string | null }>;
} {
  if (!staff.branchId) return {};
  // Matches either the staff's assigned branch or legacy null-branch rows
  // (pre-migration data) so nothing silently disappears during rollout.
  return { OR: [{ branchId: staff.branchId }, { branchId: null }] };
}

/**
 * Branch the session is bound to when being created from staff context.
 * HQ staff passing through POS fall back to creating sessions with no
 * branch attribution — safe, since HQ view covers null.
 */
export function staffBranchId(staff: StaffSession): string | null {
  return staff.branchId ?? null;
}
