import { prisma } from "@/lib/prisma";
import { planOf, PLANS } from "@/lib/plans";
import { formatVND } from "@/lib/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  params,
}: {
  params: { restaurantId: string };
}) {
  const r = await prisma.restaurant.findUnique({
    where: { id: params.restaurantId },
    select: {
      id: true,
      name: true,
      planTier: true,
      trialEndsAt: true,
      status: true,
      approvedAt: true,
      _count: { select: { tables: true, staff: true } },
    },
  });
  if (!r) notFound();

  const current = planOf(r.planTier);
  const daysLeft =
    r.trialEndsAt && r.planTier === "TRIAL"
      ? Math.max(
          0,
          Math.ceil((r.trialEndsAt.getTime() - Date.now()) / 86400000),
        )
      : null;
  const nonAdminStaff = await prisma.staff.count({
    where: {
      restaurantId: r.id,
      role: { in: ["WAITER", "KITCHEN"] },
    },
  });

  const usageTables = r._count.tables;
  const usageStaff = nonAdminStaff;
  const tablePercent = Math.min(
    100,
    current.limits.maxTables === Infinity
      ? 0
      : Math.round((usageTables / current.limits.maxTables) * 100),
  );
  const staffPercent = Math.min(
    100,
    current.limits.maxNonAdminStaff === Infinity
      ? 0
      : Math.round((usageStaff / current.limits.maxNonAdminStaff) * 100),
  );

  const upgradePath: Record<string, string | null> = {
    TRIAL: "STARTER",
    STARTER: "PRO",
    PRO: "ENTERPRISE",
    ENTERPRISE: null,
  };
  const nextPlan = upgradePath[r.planTier]
    ? PLANS[upgradePath[r.planTier] as keyof typeof PLANS]
    : null;

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">
        Gói & thanh toán
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        Quản lý gói dịch vụ của <span className="font-semibold">{r.name}</span>.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Current plan */}
        <div className="rounded-3xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 to-white p-6 shadow-lg shadow-brand-200/30">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                Gói hiện tại
              </div>
              <div className="mt-1 font-display text-3xl font-bold text-ink-950">
                {current.label}
              </div>
              <div className="mt-1 text-sm text-ink-600">{current.tagline}</div>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl font-bold text-brand-700">
                {current.priceLabel}
              </div>
              {current.priceVND > 0 && (
                <div className="text-xs text-ink-500">/ tháng</div>
              )}
            </div>
          </div>

          {daysLeft !== null && (
            <div
              className={`mt-5 rounded-xl p-4 ${
                daysLeft <= 3 ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"
              }`}
            >
              <div className="font-semibold">
                {daysLeft <= 0
                  ? "⚠️ Đã hết thử nghiệm"
                  : `⏳ Còn ${daysLeft} ngày dùng thử`}
              </div>
              {r.trialEndsAt && (
                <div className="text-xs">
                  Hết hạn: {new Date(r.trialEndsAt).toLocaleDateString("vi-VN")}
                </div>
              )}
            </div>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <UsageBar
              label="Bàn"
              used={usageTables}
              limit={current.limits.maxTables}
              percent={tablePercent}
            />
            <UsageBar
              label="Nhân viên (WAITER+KITCHEN)"
              used={usageStaff}
              limit={current.limits.maxNonAdminStaff}
              percent={staffPercent}
            />
          </div>

          <ul className="mt-6 space-y-2 text-sm">
            {current.bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="text-brand-600">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Upgrade suggestion */}
        <div className="space-y-4">
          {nextPlan && (
            <div className="rounded-3xl border border-ink-100 bg-white p-6">
              <div className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                Nâng cấp lên
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="font-display text-2xl font-bold">{nextPlan.label}</div>
                <div className="font-display text-2xl font-bold text-brand-700">
                  {nextPlan.priceLabel}
                </div>
              </div>
              <p className="mt-1 text-sm text-ink-600">{nextPlan.tagline}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {nextPlan.bullets.slice(0, 4).map((b) => (
                  <li key={b} className="flex gap-2 text-ink-700">
                    <span className="text-brand-600">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <a
                href="mailto:hi@servify.vn?subject=Yêu%20cầu%20nâng%20cấp%20gói%20Servify"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-brand-600 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700"
              >
                📧 Yêu cầu nâng cấp
              </a>
              <p className="mt-2 text-center text-[11px] text-ink-500">
                Servify HQ sẽ gọi lại để hướng dẫn thanh toán & kích hoạt
              </p>
            </div>
          )}

          <div className="rounded-3xl border border-ink-100 bg-white p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-ink-500">
              Hỗ trợ
            </div>
            <div className="mt-2 space-y-1.5 text-sm text-ink-700">
              <div>📧 hi@servify.vn</div>
              <div>📞 0909 999 888</div>
              <div>💬 Zalo OA: @servify</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsageBar({
  label,
  used,
  limit,
  percent,
}: {
  label: string;
  used: number;
  limit: number;
  percent: number;
}) {
  const isUnlimited = limit === Infinity;
  const critical = percent >= 90;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold uppercase tracking-widest text-ink-500">
          {label}
        </span>
        <span className={`font-mono text-sm ${critical ? "text-red-600 font-bold" : "text-ink-800"}`}>
          {used} / {isUnlimited ? "∞" : limit}
        </span>
      </div>
      {!isUnlimited && (
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
          <div
            className={`h-full rounded-full transition-all ${
              critical
                ? "bg-gradient-to-r from-red-400 to-red-600"
                : "bg-gradient-to-r from-brand-400 to-brand-600"
            }`}
            style={{ width: `${Math.max(2, percent)}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="mt-1 text-[10px] text-ink-500">Không giới hạn</div>
      )}
      {percent >= 100 && (
        <div className="mt-1 text-xs text-red-600">
          ⚠️ Đã đạt giới hạn — nâng cấp để thêm {label.toLowerCase()}
        </div>
      )}
    </div>
  );
}

void formatVND;
