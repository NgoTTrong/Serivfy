import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import KitchenScreen from "./KitchenScreen";

export const dynamic = "force-dynamic";

export default async function KitchenPage({ params }: { params: { restaurantId: string } }) {
  const s = await getStaffSession();
  if (!s) redirect("/admin/login");
  if (s.restaurantId !== params.restaurantId) redirect("/admin/login");
  if (!["ADMIN", "KITCHEN"].includes(s.role)) redirect("/admin/login");
  return <KitchenScreen restaurantId={params.restaurantId} staffName={s.name} />;
}
