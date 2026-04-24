import { prisma } from "./prisma";

export type PulseScope = "kitchen" | "tables" | "menu" | "customer";

/**
 * Bump one or more scope counters for a tenant. Idempotent UPSERT — the
 * first writer creates the row, subsequent writers increment. Swallows
 * errors because pulse is best-effort: a missed bump just means clients
 * refetch on the next natural poll boundary.
 */
export async function bumpPulse(
  restaurantId: string,
  scopes: PulseScope | PulseScope[],
): Promise<void> {
  const list = Array.isArray(scopes) ? scopes : [scopes];
  if (list.length === 0) return;

  // Build column lists dynamically but safely — scopes are a closed enum so
  // we can map them to fixed column names with no user input risk.
  const cols: Record<PulseScope, string> = {
    kitchen: "kitchenVersion",
    tables: "tablesVersion",
    menu: "menuVersion",
    customer: "customerVersion",
  };
  const setParts = list.map((s) => `"${cols[s]}" = "RestaurantPulse"."${cols[s]}" + 1`);
  const insertCols = list.map((s) => `"${cols[s]}"`).join(", ");
  const insertVals = list.map(() => "1").join(", ");

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "RestaurantPulse" ("restaurantId", ${insertCols}, "updatedAt")
       VALUES ($1, ${insertVals}, NOW())
       ON CONFLICT ("restaurantId") DO UPDATE SET
         ${setParts.join(", ")},
         "updatedAt" = NOW()`,
      restaurantId,
    );
  } catch {
    // Best effort; do not fail the parent mutation on pulse write errors.
  }
}

const SCOPE_TO_COL: Record<PulseScope, string> = {
  kitchen: "kitchenVersion",
  tables: "tablesVersion",
  menu: "menuVersion",
  customer: "customerVersion",
};

export async function readPulse(
  restaurantId: string,
  scope: PulseScope,
): Promise<number> {
  const col = SCOPE_TO_COL[scope];
  const rows = await prisma.$queryRawUnsafe<Array<{ v: number }>>(
    `SELECT "${col}" AS v FROM "RestaurantPulse" WHERE "restaurantId" = $1`,
    restaurantId,
  );
  return rows[0]?.v ?? 0;
}
