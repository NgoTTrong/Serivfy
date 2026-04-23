import bcrypt from "bcryptjs";
import type { Prisma, PrismaClient } from "@prisma/client";
import { planOf, type PlanTier } from "./plans";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Seeds a fresh restaurant with demo data scoped to its plan tier so the
 * new admin can immediately try every feature end-to-end.
 *
 * Creates:
 *  - Categories (4 fixed)
 *  - N menu items (scaled)
 *  - N tables (Bàn 1..N, stable qrToken = qr_ban_<n>_<slug>)
 *  - 1 demo WAITER + 1..N KITCHEN staff (demo+<suffix>@{slug})
 *  - Past closed sessions with orders so dashboard has data
 */
export async function seedSampleData(
  tx: Tx,
  restaurant: { id: string; slug: string; planTier: string },
) {
  const plan = planOf(restaurant.planTier);
  const sd = plan.sampleData;

  // ---------- Categories ----------
  const [catMain, catApp, catDrink, catDessert] = await Promise.all([
    tx.category.create({ data: { restaurantId: restaurant.id, name: "Món chính", order: 1 } }),
    tx.category.create({ data: { restaurantId: restaurant.id, name: "Khai vị", order: 2 } }),
    tx.category.create({ data: { restaurantId: restaurant.id, name: "Đồ uống", order: 3 } }),
    tx.category.create({ data: { restaurantId: restaurant.id, name: "Tráng miệng", order: 4 } }),
  ]);

  // ---------- Menu ----------
  const FULL_MENU: Array<{
    name: string;
    desc: string;
    price: number;
    catId: string;
    image: string;
  }> = [
    { name: "Phở bò tái", desc: "Nước dùng bò ninh xương 12 giờ", price: 75000, catId: catMain.id, image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80" },
    { name: "Bún chả Hà Nội", desc: "Chả nướng than hoa", price: 70000, catId: catMain.id, image: "https://images.unsplash.com/photo-1583835746434-cf1534674b41?w=800&q=80" },
    { name: "Cơm tấm sườn bì", desc: "Sườn nướng mật ong, bì, trứng", price: 65000, catId: catMain.id, image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80" },
    { name: "Bún bò Huế", desc: "Cay nồng đặc trưng cố đô", price: 75000, catId: catMain.id, image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80" },
    { name: "Cá kho tộ", desc: "Cá kho nước dừa", price: 120000, catId: catMain.id, image: "https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=800&q=80" },
    { name: "Gà nướng lá chanh", desc: "Nửa con, da giòn thơm", price: 180000, catId: catMain.id, image: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80" },
    { name: "Gỏi cuốn tôm thịt", desc: "2 cuốn, nước chấm đặc biệt", price: 45000, catId: catApp.id, image: "https://images.unsplash.com/photo-1553830591-fddf9c0c8a56?w=800&q=80" },
    { name: "Chả giò rế", desc: "Giòn rụm, 4 cuốn", price: 50000, catId: catApp.id, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80" },
    { name: "Nem nướng Nha Trang", desc: "Ăn kèm bánh tráng rau", price: 85000, catId: catApp.id, image: "https://images.unsplash.com/photo-1626509653291-18d9a934b9db?w=800&q=80" },
    { name: "Đậu hũ chiên sả ớt", desc: "", price: 40000, catId: catApp.id, image: "" },
    { name: "Trà đá", desc: "", price: 5000, catId: catDrink.id, image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80" },
    { name: "Nước mía", desc: "Ép tại chỗ", price: 15000, catId: catDrink.id, image: "https://images.unsplash.com/photo-1560526860-1f0e56046c85?w=800&q=80" },
    { name: "Cà phê sữa đá", desc: "Cà phê Ban Mê Thuột", price: 25000, catId: catDrink.id, image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=80" },
    { name: "Sinh tố bơ", desc: "Bơ sáp Đắk Lắk", price: 35000, catId: catDrink.id, image: "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=800&q=80" },
    { name: "Bia Sài Gòn", desc: "Chai 330ml", price: 20000, catId: catDrink.id, image: "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=800&q=80" },
    { name: "Chè ba màu", desc: "Đậu đỏ, đậu xanh, thạch", price: 25000, catId: catDessert.id, image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80" },
    { name: "Bánh flan", desc: "Caramen mềm mịn", price: 20000, catId: catDessert.id, image: "https://images.unsplash.com/photo-1528716321680-815a8cdb8cbe?w=800&q=80" },
    { name: "Xôi xoài", desc: "Xôi nếp dẻo, xoài chín", price: 35000, catId: catDessert.id, image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80" },
  ];
  const menuSlice = FULL_MENU.slice(0, sd.menuItems);
  const menuIds: string[] = [];
  const menuById: Record<string, string> = {};
  for (let i = 0; i < menuSlice.length; i++) {
    const it = menuSlice[i];
    const created = await tx.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: it.catId,
        name: it.name,
        description: it.desc || null,
        price: it.price,
        image: it.image || null,
        order: i,
      },
    });
    menuIds.push(created.id);
    menuById[it.name] = created.id;
  }

  // Seed sample option groups on a few common items so new admins immediately
  // see how options work (can edit / delete later via Menu manager).
  type GroupSpec = {
    itemName: string;
    groups: Array<{
      name: string;
      required: boolean;
      multiple: boolean;
      choices: { label: string; priceDelta: number }[];
    }>;
  };
  const SAMPLE_GROUPS: GroupSpec[] = [
    {
      itemName: "Phở bò tái",
      groups: [
        {
          name: "Tô",
          required: true,
          multiple: false,
          choices: [
            { label: "Tô thường", priceDelta: 0 },
            { label: "Tô đặc biệt (+15k)", priceDelta: 15_000 },
          ],
        },
        {
          name: "Thêm",
          required: false,
          multiple: true,
          choices: [
            { label: "Thêm trứng (+5k)", priceDelta: 5_000 },
            { label: "Thêm bò viên (+10k)", priceDelta: 10_000 },
            { label: "Không hành", priceDelta: 0 },
          ],
        },
      ],
    },
    {
      itemName: "Cà phê sữa đá",
      groups: [
        {
          name: "Size",
          required: true,
          multiple: false,
          choices: [
            { label: "Size M", priceDelta: 0 },
            { label: "Size L (+5k)", priceDelta: 5_000 },
          ],
        },
        {
          name: "Độ ngọt",
          required: true,
          multiple: false,
          choices: [
            { label: "Bình thường", priceDelta: 0 },
            { label: "Ít ngọt", priceDelta: 0 },
            { label: "Không đường", priceDelta: 0 },
          ],
        },
      ],
    },
    {
      itemName: "Bún bò Huế",
      groups: [
        {
          name: "Độ cay",
          required: true,
          multiple: false,
          choices: [
            { label: "Không cay", priceDelta: 0 },
            { label: "Cay vừa", priceDelta: 0 },
            { label: "Cay đặc biệt", priceDelta: 0 },
          ],
        },
      ],
    },
  ];
  for (const spec of SAMPLE_GROUPS) {
    const itemId = menuById[spec.itemName];
    if (!itemId) continue;
    for (let gi = 0; gi < spec.groups.length; gi++) {
      const g = spec.groups[gi];
      await tx.menuOptionGroup.create({
        data: {
          menuItemId: itemId,
          name: g.name,
          required: g.required,
          multiple: g.multiple,
          order: gi,
          choices: {
            create: g.choices.map((c, ci) => ({
              label: c.label,
              priceDelta: c.priceDelta,
              order: ci,
            })),
          },
        },
      });
    }
  }

  // ---------- Tables ----------
  const tableIds: string[] = [];
  for (let n = 1; n <= sd.tables; n++) {
    const t = await tx.table.create({
      data: {
        restaurantId: restaurant.id,
        number: n,
        label: `Bàn ${n}`,
        capacity: n <= 2 ? 2 : n <= 6 ? 4 : 6,
        qrToken: `qr_ban_${n}_${restaurant.slug}`,
      },
    });
    tableIds.push(t.id);
  }

  // ---------- Demo staff (waiter + kitchen) ----------
  const demoHash = await bcrypt.hash("123456", 10);
  const staffCreated: { id: string; role: string }[] = [];
  for (let i = 0; i < sd.waiters; i++) {
    const s = await tx.staff.create({
      data: {
        restaurantId: restaurant.id,
        name: `Nhân viên phục vụ ${i + 1}`,
        email: `waiter${i + 1}.${restaurant.slug}@demo.servify.vn`,
        role: "WAITER",
        passwordHash: demoHash,
      },
    });
    staffCreated.push(s);
  }
  for (let i = 0; i < sd.kitchens; i++) {
    const s = await tx.staff.create({
      data: {
        restaurantId: restaurant.id,
        name: `Bếp ${i + 1}`,
        email: `kitchen${i + 1}.${restaurant.slug}@demo.servify.vn`,
        role: "KITCHEN",
        passwordHash: demoHash,
      },
    });
    staffCreated.push(s);
  }

  // ---------- Past orders (closed sessions) for dashboard demo ----------
  for (let i = 0; i < sd.pastOrders && tableIds.length > 0; i++) {
    const tableId = tableIds[i % tableIds.length];
    const openedAt = new Date(Date.now() - (i + 1) * 3600 * 1000); // stagger across today
    const closedAt = new Date(openedAt.getTime() + 45 * 60 * 1000);
    const session = await tx.tableSession.create({
      data: {
        tableId,
        restaurantId: restaurant.id,
        status: "CLOSED",
        openedAt,
        closedAt,
        paidAt: closedAt,
        paymentMethod: i % 2 === 0 ? "CASH" : "BANK_TRANSFER",
        receiptNumber: `SVF-DEMO-${String(i + 1).padStart(3, "0")}`,
      },
    });
    const guest = await tx.guest.create({
      data: {
        sessionId: session.id,
        deviceId: `demo_${i}`,
        nickname: `Khách demo ${i + 1}`,
      },
    });
    const round = await tx.orderRound.create({
      data: {
        sessionId: session.id,
        roundNumber: 1,
        status: "SERVED",
        createdAt: openedAt,
      },
    });
    // 2-4 random items per order
    const itemCount = 2 + (i % 3);
    let totalPaid = 0;
    const picked = new Set<number>();
    for (let k = 0; k < itemCount && picked.size < menuSlice.length; k++) {
      let idx = (i * 3 + k * 5) % menuSlice.length;
      while (picked.has(idx)) idx = (idx + 1) % menuSlice.length;
      picked.add(idx);
      const qty = 1 + (k % 2);
      const price = menuSlice[idx].price;
      totalPaid += price * qty;
      await tx.orderItem.create({
        data: {
          roundId: round.id,
          guestId: guest.id,
          menuItemId: menuIds[idx],
          quantity: qty,
          servedQty: qty,
          priceAtOrder: price,
          createdAt: openedAt,
        },
      });
    }
    await tx.tableSession.update({
      where: { id: session.id },
      data: { paidAmount: totalPaid },
    });
  }

  return {
    tableCount: tableIds.length,
    menuCount: menuIds.length,
    demoStaffCount: staffCreated.length,
  };
}
