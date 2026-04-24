import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";
import CombosClient from "./CombosClient";

export const dynamic = "force-dynamic";

export default async function CombosPage({
  params,
}: {
  params: { restaurantId: string };
}) {
  const staff = await getStaffSession();
  if (!staff || staff.restaurantId !== params.restaurantId || staff.role !== "ADMIN") {
    redirect("/admin/login");
  }
  const items = await prisma.menuItem.findMany({
    where: { restaurantId: params.restaurantId, deletedAt: null },
    orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
    select: {
      id: true,
      name: true,
      price: true,
      image: true,
      category: { select: { name: true } },
    },
  });
  return (
    <CombosClient
      restaurantId={params.restaurantId}
      allItems={items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        image: i.image,
        categoryName: i.category.name,
      }))}
    />
  );
}
