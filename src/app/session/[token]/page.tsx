import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CustomerApp from "./CustomerApp";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: { token: string } }) {
  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    include: {
      restaurant: { select: { id: true, name: true, tagline: true, logo: true } },
      table: { select: { id: true, label: true, number: true } },
    },
  });
  if (!session) notFound();

  if (session.status === "CLOSED") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-50 p-6 text-center">
        <div>
          <div className="text-6xl">🍽️</div>
          <h1 className="mt-5 font-display text-3xl font-bold text-ink-950">
            Phiên đã kết thúc
          </h1>
          <p className="mt-3 text-ink-600">
            {session.table.label} · {session.restaurant.name}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            Vui lòng quét lại mã QR trên bàn để bắt đầu phiên mới.
          </p>
        </div>
      </main>
    );
  }

  return (
    <CustomerApp
      sessionToken={session.token}
      restaurant={session.restaurant}
      table={session.table}
    />
  );
}
