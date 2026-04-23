import { PrismaClient } from "@prisma/client";
import { settleSessionToMemory } from "../src/lib/memory";
const prisma = new PrismaClient();
(async () => {
  // Find any closed session with paid
  const s = await prisma.tableSession.findFirst({
    where: { status: "CLOSED", paidAmount: { not: null } },
    include: { guests: true, rounds: { include: { items: true } } },
    orderBy: { closedAt: "desc" },
  });
  if (!s) {
    console.log("No closed session");
    await prisma.$disconnect();
    return;
  }
  console.log("Session:", s.id, "paid:", s.paidAmount, "guests:", s.guests.length);
  for (const g of s.guests) console.log("  guest", g.deviceId, g.nickname);
  for (const r of s.rounds)
    for (const it of r.items)
      console.log(
        "  item",
        it.menuItemId,
        "guest=",
        it.guestId,
        "qty=",
        it.quantity,
        "price=",
        it.priceAtOrder,
      );

  console.log("\nRunning settle...");
  try {
    await settleSessionToMemory(s.id);
    console.log("OK");
  } catch (e) {
    console.error("ERROR:", e);
  }

  const devices = await prisma.customerDevice.findMany({
    where: { restaurantId: s.restaurantId },
    orderBy: { totalSpent: "desc" },
  });
  console.log("\nDevices after:");
  for (const d of devices)
    console.log(
      `  ${d.deviceId.slice(-6)} visit=${d.visitCount} spent=${d.totalSpent}`,
    );
  await prisma.$disconnect();
})();
