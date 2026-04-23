import { redirect } from "next/navigation";
import { getPlatformSession } from "@/lib/platform-auth";
import DetailClient from "./DetailClient";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const s = await getPlatformSession();
  if (!s) redirect("/superadmin/login");
  return <DetailClient id={params.id} />;
}
