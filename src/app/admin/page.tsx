import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminIndex() {
  const s = await getStaffSession();
  if (!s) redirect("/admin/login");
  if (s.role === "ADMIN") redirect(`/admin/${s.restaurantId}/dashboard`);
  if (s.role === "WAITER") redirect(`/waiter/${s.restaurantId}`);
  if (s.role === "KITCHEN") redirect(`/kitchen/${s.restaurantId}`);
  redirect("/admin/login");
}
