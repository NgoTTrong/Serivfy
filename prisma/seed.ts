import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Wipe
  await prisma.cartItem.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.orderRound.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.tableSession.deleteMany();
  await prisma.table.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.signupRequest.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.platformAdmin.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.platformSettings.deleteMany();

  // Platform settings singleton + super admin
  await prisma.platformSettings.create({
    data: { id: "SINGLETON", autoApprove: false },
  });
  const platformHash = await bcrypt.hash("123456", 10);
  await prisma.platformAdmin.create({
    data: {
      email: "superadmin@servify.vn",
      name: "Servify HQ",
      passwordHash: platformHash,
    },
  });

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Quán Bà Nội",
      slug: "quan-ba-noi",
      tagline: "Hương vị Việt, bữa cơm nhà",
      address: "123 Phan Chu Trinh, Q.1, TP.HCM",
      phone: "0901 234 567",
      taxCode: "0123456789",
      bankName: "VCB",
      bankAccountNumber: "1234567890",
      bankAccountHolder: "QUAN BA NOI",
      status: "ACTIVE",
      planTier: "PRO",
      approvedAt: new Date(),
    },
  });

  // Tables 1-10
  for (let i = 1; i <= 10; i++) {
    await prisma.table.create({
      data: {
        restaurantId: restaurant.id,
        number: i,
        label: `Bàn ${i}`,
        capacity: i <= 2 ? 2 : i <= 6 ? 4 : 6,
        qrToken: `qr_ban_${i}_${restaurant.slug}`,
      },
    });
  }

  // Categories
  const catMain = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: "Món chính", order: 1 },
  });
  const catApp = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: "Khai vị", order: 2 },
  });
  const catDrink = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: "Đồ uống", order: 3 },
  });
  const catDessert = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: "Tráng miệng", order: 4 },
  });

  // Images from Unsplash with verified-stable photo IDs. Fallback: SafeImg component shows emoji if any 404.
  const items: Array<{
    name: string;
    desc: string;
    price: number;
    catId: string;
    image: string;
  }> = [
    // Món chính
    { name: "Phở bò tái", desc: "Nước dùng bò ninh xương 12 giờ, tái mềm", price: 75000, catId: catMain.id, image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80" },
    { name: "Bún chả Hà Nội", desc: "Chả nướng than hoa, nước mắm pha chuẩn vị", price: 70000, catId: catMain.id, image: "https://images.unsplash.com/photo-1583835746434-cf1534674b41?w=800&q=80" },
    { name: "Cơm tấm sườn bì", desc: "Sườn nướng mật ong, bì heo, trứng ốp", price: 65000, catId: catMain.id, image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80" },
    { name: "Bún bò Huế", desc: "Cay nồng đặc trưng cố đô", price: 75000, catId: catMain.id, image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80" },
    { name: "Cá kho tộ", desc: "Cá basa kho nước dừa, ăn với cơm trắng", price: 120000, catId: catMain.id, image: "https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=800&q=80" },
    { name: "Gà nướng lá chanh", desc: "Nửa con, da giòn thơm lá chanh", price: 180000, catId: catMain.id, image: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80" },

    // Khai vị
    { name: "Gỏi cuốn tôm thịt", desc: "2 cuốn, kèm nước chấm đặc biệt", price: 45000, catId: catApp.id, image: "https://images.unsplash.com/photo-1553830591-fddf9c0c8a56?w=800&q=80" },
    { name: "Chả giò rế", desc: "Giòn rụm, 4 cuốn", price: 50000, catId: catApp.id, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80" },
    { name: "Nem nướng Nha Trang", desc: "Ăn kèm bánh tráng rau sống", price: 85000, catId: catApp.id, image: "https://images.unsplash.com/photo-1626509653291-18d9a934b9db?w=800&q=80" },
    { name: "Đậu hũ chiên sả ớt", desc: "", price: 40000, catId: catApp.id, image: "https://images.unsplash.com/photo-1582730147924-d96d5fe3b1e3?w=800&q=80" },

    // Đồ uống
    { name: "Trà đá", desc: "", price: 5000, catId: catDrink.id, image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80" },
    { name: "Nước mía", desc: "Ép tại chỗ", price: 15000, catId: catDrink.id, image: "https://images.unsplash.com/photo-1560526860-1f0e56046c85?w=800&q=80" },
    { name: "Cà phê sữa đá", desc: "Cà phê Ban Mê Thuột", price: 25000, catId: catDrink.id, image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=80" },
    { name: "Sinh tố bơ", desc: "Bơ sáp Đắk Lắk", price: 35000, catId: catDrink.id, image: "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=800&q=80" },
    { name: "Bia Sài Gòn", desc: "Chai 330ml", price: 20000, catId: catDrink.id, image: "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=800&q=80" },

    // Tráng miệng
    { name: "Chè ba màu", desc: "Đậu đỏ, đậu xanh, thạch, nước cốt dừa", price: 25000, catId: catDessert.id, image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80" },
    { name: "Bánh flan", desc: "Caramen mềm mịn", price: 20000, catId: catDessert.id, image: "https://images.unsplash.com/photo-1528716321680-815a8cdb8cbe?w=800&q=80" },
    { name: "Xôi xoài", desc: "Xôi nếp dẻo, xoài chín", price: 35000, catId: catDessert.id, image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80" },
  ];

  const menuByName: Record<string, string> = {};
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const created = await prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: it.catId,
        name: it.name,
        description: it.desc,
        price: it.price,
        image: it.image,
        order: i,
      },
    });
    menuByName[it.name] = created.id;
  }

  // Demo option groups so the seeded Quán Bà Nội shows off the feature
  const sampleOptions: Array<{
    itemName: string;
    groups: Array<{
      name: string;
      required: boolean;
      multiple: boolean;
      choices: { label: string; priceDelta: number }[];
    }>;
  }> = [
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
  for (const spec of sampleOptions) {
    const itemId = menuByName[spec.itemName];
    if (!itemId) continue;
    for (let gi = 0; gi < spec.groups.length; gi++) {
      const g = spec.groups[gi];
      await prisma.menuOptionGroup.create({
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

  // Staff
  const hash = await bcrypt.hash("123456", 10);
  await prisma.staff.create({
    data: {
      restaurantId: restaurant.id,
      name: "Chủ quán",
      email: "admin@test.com",
      role: "ADMIN",
      passwordHash: hash,
    },
  });
  await prisma.staff.create({
    data: {
      restaurantId: restaurant.id,
      name: "Minh Phục vụ",
      email: "waiter@test.com",
      role: "WAITER",
      passwordHash: hash,
    },
  });
  await prisma.staff.create({
    data: {
      restaurantId: restaurant.id,
      name: "Bếp",
      email: "kitchen@test.com",
      role: "KITCHEN",
      passwordHash: hash,
    },
  });

  // Demo pending signup requests so superadmin has something to review
  const pendingHash = await bcrypt.hash("123456", 10);
  await prisma.signupRequest.createMany({
    data: [
      {
        restaurantName: "Phở Bát Đàn",
        slug: "pho-bat-dan",
        adminName: "Anh Nam",
        adminEmail: "nam@phobatdan.vn",
        adminPasswordHash: pendingHash,
        phone: "0903 111 222",
        address: "49 Bát Đàn, Hoàn Kiếm, Hà Nội",
        planRequested: "PRO",
        status: "PENDING",
      },
      {
        restaurantName: "Cafe Miền Tây",
        slug: "cafe-mien-tay",
        adminName: "Chị Lan",
        adminEmail: "lan@cafemientay.vn",
        adminPasswordHash: pendingHash,
        phone: "0908 333 444",
        address: "200 CMT8, Q.3, TP.HCM",
        planRequested: "TRIAL",
        status: "PENDING",
      },
    ],
  });

  console.log("Seed done.");
  console.log("Restaurant ID:", restaurant.id);
  console.log("Sample QR tokens: qr_ban_1_quan-ba-noi ... qr_ban_10_quan-ba-noi");
  console.log("Restaurant login: admin@test.com / waiter@test.com / kitchen@test.com  (pass: 123456)");
  console.log("Platform login: superadmin@servify.vn  (pass: 123456)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
