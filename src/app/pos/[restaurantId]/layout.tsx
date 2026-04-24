import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POS is used by both ADMIN and WAITER roles — kitchen staff don't need it.
 * Kept as a sibling of /admin so we don't relax admin's ADMIN-only guard.
 */
export default async function PosLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { restaurantId: string };
}) {
  const s = await getStaffSession();
  if (!s) redirect("/admin/login");
  if (s.restaurantId !== params.restaurantId) redirect("/admin/login");
  if (s.role !== "ADMIN" && s.role !== "WAITER") redirect("/admin/login");
  return <>{children}</>;
}
