import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminShell from "./AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { restaurantId: string };
}) {
  const s = await getStaffSession();
  if (!s) redirect("/admin/login");
  if (s.restaurantId !== params.restaurantId) redirect("/admin/login");
  if (s.role !== "ADMIN") redirect("/admin/login");

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: params.restaurantId },
    select: { planTier: true, trialEndsAt: true, status: true, name: true },
  });
  if (!restaurant) redirect("/admin/login");

  const planInfo = {
    planTier: restaurant.planTier as "TRIAL" | "STARTER" | "PRO" | "ENTERPRISE",
    trialEndsAt: restaurant.trialEndsAt?.toISOString() ?? null,
    daysLeft:
      restaurant.trialEndsAt && restaurant.planTier === "TRIAL"
        ? Math.ceil(
            (restaurant.trialEndsAt.getTime() - Date.now()) / 86400000,
          )
        : null,
  };

  return (
    <AdminShell
      restaurantId={params.restaurantId}
      staffName={s.name}
      restaurantName={restaurant.name}
      planInfo={planInfo}
    >
      {children}
    </AdminShell>
  );
}
