import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cacheOrCompute, cacheDelete } from "@/lib/cache";
import { readPulse } from "@/lib/pulse";

const MENU_TTL_MS = 30_000;

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { restaurantId: true, status: true },
  });
  if (!session) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Version-aware cache: when admin edits the menu, bumpPulse("menu") fires
  // and the cache entry for the prior version goes stale on its own — new
  // reads hit a new key and refill. Much cheaper than DB-TTL invalidation.
  const menuVersion = await readPulse(session.restaurantId, "menu");
  const key = `menu:${session.restaurantId}:${menuVersion}`;

  const categories = await cacheOrCompute(key, MENU_TTL_MS, async () => {
    const cats = await prisma.category.findMany({
      where: { restaurantId: session.restaurantId, deletedAt: null },
      orderBy: { order: "asc" },
      include: {
        menuItems: {
          where: { deletedAt: null },
          orderBy: [{ order: "asc" }, { name: "asc" }],
          include: {
            optionGroups: {
              orderBy: { order: "asc" },
              include: { choices: { orderBy: { order: "asc" } } },
            },
            modifiers: {
              orderBy: { order: "asc" },
              include: {
                template: {
                  include: { choices: { orderBy: { order: "asc" } } },
                },
              },
            },
          },
        },
      },
    });
    // Merge reusable modifier templates into the `optionGroups` shape the
    // customer app already consumes. Choice ids remain globally unique so
    // cart add matches work whether the choice came from a per-item group
    // or a shared template.
    return cats.map((c) => ({
      ...c,
      menuItems: c.menuItems.map((it) => {
        const templateGroups = it.modifiers
          .filter((m) => m.template && !m.template.deletedAt)
          .map((m) => ({
            id: `tpl:${m.template.id}`,
            menuItemId: it.id,
            name: m.template.name,
            required: m.template.required,
            multiple: m.template.multiple,
            order: 1000 + m.order,
            choices: m.template.choices,
          }));
        const { modifiers: _mods, ...itemRest } = it;
        void _mods;
        return {
          ...itemRest,
          optionGroups: [...it.optionGroups, ...templateGroups],
        };
      }),
    }));
  });

  // Clean up the previous version's key lazily when a newer version is seen.
  // Keeps the cache from accumulating dead entries for the same tenant.
  if (menuVersion > 0) {
    cacheDelete(`menu:${session.restaurantId}:${menuVersion - 1}`);
  }

  return NextResponse.json({ categories });
}
