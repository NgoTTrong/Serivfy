import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const d = await prisma.customerDevice.findFirst({
    where: { nickname: "An" },
    orderBy: { lastVisit: "desc" },
  });
  console.log("Device:", JSON.stringify(d, null, 2));
  const sessions = await prisma.tableSession.findMany({
    where: { status: "CLOSED", paidAmount: { not: null } },
    include: { guests: true, rounds: { include: { items: true } } },
    orderBy: { closedAt: "desc" },
    take: 3,
  });
  console.log("\nRecent closed sessions:");
  for (const s of sessions) {
    console.log(
      `  ${s.id} paid=${s.paidAmount} guests=${s.guests.length} items=${s.rounds.reduce((a, r) => a + r.items.length, 0)}`,
    );
    for (const g of s.guests) console.log(`    guest ${g.deviceId} (${g.nickname})`);
  }
  await prisma.$disconnect();
})();
