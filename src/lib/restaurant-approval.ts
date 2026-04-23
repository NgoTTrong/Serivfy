import { prisma } from "./prisma";
import { slugify } from "./slug";
import { seedSampleData } from "./sample-seed";
import type { PlanTier } from "./plans";

const TRIAL_DAYS = 14;

export async function ensureUniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "quan";
  let candidate = root;
  let i = 1;
  while (true) {
    const [r, sr] = await Promise.all([
      prisma.restaurant.findUnique({ where: { slug: candidate } }),
      prisma.signupRequest.findUnique({ where: { slug: candidate } }),
    ]);
    if (!r && !sr) return candidate;
    i += 1;
    candidate = `${root}-${i}`;
  }
}

type ApprovedResult = {
  restaurantId: string;
  slug: string;
  adminEmail: string;
  adminName: string;
  sample: { tableCount: number; menuCount: number; demoStaffCount: number };
};

/**
 * Approve a signup request. Creates:
 *  - Restaurant (plan = requested; TRIAL gets trialEndsAt = +14d)
 *  - First ADMIN Staff (from request)
 *  - Full demo data seeded via seedSampleData (menu, tables, demo staff, past orders)
 *
 * Idempotent: returning request already holds createdRestaurantId on repeat approves.
 */
export async function approveSignupRequest(
  requestId: string,
  approver: { id: string; name: string } | null,
): Promise<ApprovedResult> {
  const req = await prisma.signupRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new Error("REQUEST_NOT_FOUND");
  if (req.status === "APPROVED" && req.createdRestaurantId) {
    const r = await prisma.restaurant.findUniqueOrThrow({
      where: { id: req.createdRestaurantId },
    });
    return {
      restaurantId: r.id,
      slug: r.slug,
      adminEmail: req.adminEmail,
      adminName: req.adminName,
      sample: { tableCount: 0, menuCount: 0, demoStaffCount: 0 },
    };
  }
  if (req.status === "REJECTED") throw new Error("REQUEST_ALREADY_REJECTED");

  const existing = await prisma.staff.findUnique({ where: { email: req.adminEmail } });
  if (existing) throw new Error("EMAIL_TAKEN");

  const finalSlug = await ensureUniqueSlug(req.slug);
  const planTier = req.planRequested as PlanTier;
  const trialEndsAt =
    planTier === "TRIAL" ? new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000) : null;

  const result = await prisma.$transaction(async (tx) => {
    const r = await tx.restaurant.create({
      data: {
        name: req.restaurantName,
        slug: finalSlug,
        phone: req.phone,
        address: req.address,
        status: "ACTIVE",
        planTier,
        trialEndsAt,
        approvedAt: new Date(),
        approvedBy: approver?.id ?? null,
      },
    });
    await tx.staff.create({
      data: {
        restaurantId: r.id,
        name: req.adminName,
        email: req.adminEmail,
        role: "ADMIN",
        passwordHash: req.adminPasswordHash,
      },
    });
    const sample = await seedSampleData(tx as never, {
      id: r.id,
      slug: r.slug,
      planTier: r.planTier,
    });
    await tx.signupRequest.update({
      where: { id: req.id },
      data: {
        status: "APPROVED",
        reviewedBy: approver?.id ?? null,
        reviewedAt: new Date(),
        createdRestaurantId: r.id,
      },
    });
    return { r, sample };
  });

  return {
    restaurantId: result.r.id,
    slug: result.r.slug,
    adminEmail: req.adminEmail,
    adminName: req.adminName,
    sample: result.sample,
  };
}

export async function rejectSignupRequest(
  requestId: string,
  reason: string,
  reviewer: { id: string; name: string },
) {
  await prisma.signupRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      reviewedBy: reviewer.id,
      reviewedAt: new Date(),
      rejectReason: reason,
    },
  });
}
