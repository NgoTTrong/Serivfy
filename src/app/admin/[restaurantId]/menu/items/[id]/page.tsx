import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";
import ItemEditor from "./ItemEditor";

export const dynamic = "force-dynamic";

export default async function MenuItemDetailPage({
  params,
}: {
  params: { restaurantId: string; id: string };
}) {
  const staff = await getStaffSession();
  if (!staff || staff.restaurantId !== params.restaurantId || staff.role !== "ADMIN") {
    redirect("/admin/login");
  }

  const [item, categories, stations, templates] = await Promise.all([
    prisma.menuItem.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        station: { select: { id: true, name: true } },
        optionGroups: {
          orderBy: { order: "asc" },
          include: { choices: { orderBy: { order: "asc" } } },
        },
        modifiers: { orderBy: { order: "asc" }, select: { templateId: true } },
      },
    }),
    prisma.category.findMany({
      where: { restaurantId: params.restaurantId, deletedAt: null },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    prisma.station.findMany({
      where: { restaurantId: params.restaurantId },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    prisma.modifierTemplate.findMany({
      where: { restaurantId: params.restaurantId, deletedAt: null },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: { choices: { orderBy: { order: "asc" } } },
    }),
  ]);
  if (!item || item.restaurantId !== params.restaurantId || item.deletedAt) notFound();

  return (
    <ItemEditor
      restaurantId={params.restaurantId}
      item={{
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        isAvailable: item.isAvailable,
        categoryId: item.categoryId,
        stationId: item.stationId,
        optionGroups: item.optionGroups.map((g) => ({
          id: g.id,
          name: g.name,
          required: g.required,
          multiple: g.multiple,
          choices: g.choices.map((c) => ({
            id: c.id,
            label: c.label,
            priceDelta: c.priceDelta,
          })),
        })),
        attachedTemplateIds: item.modifiers.map((m) => m.templateId),
      }}
      categories={categories}
      stations={stations}
      allTemplates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        required: t.required,
        multiple: t.multiple,
        choices: t.choices.map((c) => ({ label: c.label, priceDelta: c.priceDelta })),
      }))}
    />
  );
}
