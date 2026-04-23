import { PrismaClient } from "@prisma/client";
import { settleSessionToMemory } from "../src/lib/memory";
const prisma = new PrismaClient();
(async () => {
  // Find closed session with items
  const all = await prisma.tableSession.findMany({
    where: { status: "CLOSED", paidAmount: { not: null } },
    include: { rounds: { include: { items: true } } },
  });
  const withItems = all.find((s) => s.rounds.some((r) => r.items.length > 0));
  if (!withItems) {
    console.log("No closed session with items. Creating fake test...");
    await prisma.$disconnect();
    return;
  }
  console.log(
    "Found session with items:",
    withItems.id,
    "items:",
    withItems.rounds.reduce((a, r) => a + r.items.length, 0),
  );
  await settleSessionToMemory(withItems.id);
  const devices = await prisma.customerDevice.findMany({
    where: { restaurantId: withItems.restaurantId },
    orderBy: { totalSpent: "desc" },
  });
  for (const d of devices)
    console.log(`  ${d.deviceId.slice(-6)} visit=${d.visitCount} spent=${d.totalSpent} favs=${d.favoriteJson ? d.favoriteJson.slice(0,80) : "null"}`);
  await prisma.$disconnect();
})();
