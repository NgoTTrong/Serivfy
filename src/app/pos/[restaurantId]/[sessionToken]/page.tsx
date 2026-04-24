import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";
import PosMenu from "./PosMenu";

export const dynamic = "force-dynamic";

export default async function PosSessionPage({
  params,
}: {
  params: { restaurantId: string; sessionToken: string };
}) {
  const staff = await getStaffSession();
  if (!staff || staff.restaurantId !== params.restaurantId) {
    redirect("/admin/login");
  }

  const session = await prisma.tableSession.findUnique({
    where: { token: params.sessionToken },
    include: {
      restaurant: { select: { id: true, name: true } },
      table: { select: { id: true, label: true, number: true } },
    },
  });
  if (!session || session.restaurantId !== params.restaurantId) notFound();

  // Look up (or auto-create) the staff guest row for this session so the POS
  // UI starts with a guestId ready to attach cart items. The /pos/open
  // endpoint already creates this on navigation, but if the staff bookmarked
  // the session URL we still want the page to work.
  const deviceId = `staff:${staff.sub}`;
  const guest = await prisma.guest.upsert({
    where: { sessionId_deviceId: { sessionId: session.id, deviceId } },
    update: {},
    create: {
      sessionId: session.id,
      deviceId,
      nickname: `NV · ${staff.name}`,
    },
  });

  if (session.status === "CLOSED") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <div className="text-5xl">🍽️</div>
          <h1 className="mt-4 font-display text-2xl font-bold">Phiên đã đóng</h1>
          <p className="mt-2 text-ink-600">
            {session.table.label} đã thanh toán. Vào lại{" "}
            <a href={`/pos/${params.restaurantId}`} className="underline">
              POS
            </a>{" "}
            để mở bàn khác.
          </p>
        </div>
      </main>
    );
  }

  return (
    <PosMenu
      restaurantId={params.restaurantId}
      sessionToken={session.token}
      sessionId={session.id}
      tableId={session.table.id}
      tableLabel={session.table.label}
      guestId={guest.id}
      staffName={staff.name}
    />
  );
}
