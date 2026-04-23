import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import WaiterApp from "./WaiterApp";

export const dynamic = "force-dynamic";

export default async function WaiterPage({ params }: { params: { restaurantId: string } }) {
  const s = await getStaffSession();
  if (!s) redirect("/admin/login");
  if (s.restaurantId !== params.restaurantId) redirect("/admin/login");
  if (!["ADMIN", "WAITER"].includes(s.role)) redirect("/admin/login");
  return <WaiterApp restaurantId={params.restaurantId} staffName={s.name} />;
}
