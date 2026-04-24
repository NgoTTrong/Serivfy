import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";
import { buildReceiptPayload } from "@/lib/receipt";
import ReceiptPrint from "./ReceiptPrint";

export const dynamic = "force-dynamic";

export default async function PrintReceiptPage({
  params,
  searchParams,
}: {
  params: { sessionId: string };
  searchParams: { autoprint?: string; width?: string };
}) {
  // Staff-only: anyone with a valid staff cookie for the owning restaurant
  // can print. Works for both waiter + admin roles.
  const staff = await getStaffSession();
  if (!staff) notFound();

  const paperWidth = searchParams.width === "58" ? 58 : 80;
  const session = await prisma.tableSession.findUnique({
    where: { id: params.sessionId },
    select: { restaurantId: true },
  });
  if (!session || session.restaurantId !== staff.restaurantId) {
    notFound();
  }

  const payload = await buildReceiptPayload(params.sessionId, paperWidth as 58 | 80);
  if (!payload) notFound();

  return (
    <ReceiptPrint
      payload={payload}
      vietQr={payload.vietQr ?? null}
      autoprint={searchParams.autoprint === "1"}
    />
  );
}
