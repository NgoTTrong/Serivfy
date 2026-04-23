import { redirect } from "next/navigation";
import { getPlatformSession } from "@/lib/platform-auth";
import RestaurantsClient from "./RestaurantsClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await getPlatformSession();
  if (!s) redirect("/superadmin/login");
  return <RestaurantsClient />;
}
