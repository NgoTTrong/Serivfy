export type PlanTier = "TRIAL" | "STARTER" | "PRO" | "ENTERPRISE";

export type PlanLimits = {
  maxTables: number;
  maxNonAdminStaff: number; // waiters + kitchen
  features: {
    vietQR: boolean;
    advancedReports: boolean;
    multiBranch: boolean;
    customBranding: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
  };
};

export type PlanConfig = {
  tier: PlanTier;
  label: string;
  priceVND: number; // per month, 0 = trial / enterprise-on-request
  priceLabel: string;
  tagline: string;
  limits: PlanLimits;
  bullets: string[];
  cta: string;
  highlight?: boolean;
  sampleData: {
    tables: number;
    menuItems: number; // full menu = 18, scale down for demo
    waiters: number;
    kitchens: number;
    pastOrders: number; // seeded historical orders for dashboard demo
  };
};

const INF = Number.POSITIVE_INFINITY;

export const PLANS: Record<PlanTier, PlanConfig> = {
  TRIAL: {
    tier: "TRIAL",
    label: "Dùng thử",
    priceVND: 0,
    priceLabel: "0đ",
    tagline: "14 ngày miễn phí · không thẻ tín dụng",
    limits: {
      maxTables: 3,
      maxNonAdminStaff: 2,
      features: {
        vietQR: true, // full feature trial
        advancedReports: true,
        multiBranch: false,
        customBranding: false,
        apiAccess: false,
        prioritySupport: false,
      },
    },
    bullets: [
      "3 bàn · đủ xem quán mình trông ra sao",
      "2 nhân viên (phục vụ + bếp)",
      "VietQR, in hoá đơn, dashboard đầy đủ",
      "Hết 14 ngày không tự trừ tiền",
    ],
    cta: "Bắt đầu miễn phí",
    sampleData: { tables: 3, menuItems: 10, waiters: 1, kitchens: 1, pastOrders: 2 },
  },
  STARTER: {
    tier: "STARTER",
    label: "Starter",
    priceVND: 199_000,
    priceLabel: "199,000đ",
    tagline: "Cho quán đơn 1 điểm",
    limits: {
      maxTables: 15,
      maxNonAdminStaff: 5,
      features: {
        vietQR: true,
        advancedReports: false,
        multiBranch: false,
        customBranding: false,
        apiAccess: false,
        prioritySupport: false,
      },
    },
    bullets: [
      "15 bàn · 5 nhân viên",
      "VietQR · in hoá đơn · KDS bếp",
      "Email hỗ trợ 5 ngày/tuần",
      "Xuất báo cáo doanh thu CSV theo ngày",
    ],
    cta: "Chọn Starter",
    sampleData: { tables: 8, menuItems: 14, waiters: 2, kitchens: 1, pastOrders: 4 },
  },
  PRO: {
    tier: "PRO",
    label: "Pro",
    priceVND: 499_000,
    priceLabel: "499,000đ",
    tagline: "Quán vừa tới chuỗi nhỏ",
    limits: {
      maxTables: 50,
      maxNonAdminStaff: INF,
      features: {
        vietQR: true,
        advancedReports: true,
        multiBranch: false,
        customBranding: true,
        apiAccess: false,
        prioritySupport: true,
      },
    },
    bullets: [
      "50 bàn · nhân viên không giới hạn",
      "Báo cáo nâng cao (trend, món bán chạy, giờ vàng)",
      "Custom logo/màu sắc/receipt branding",
      "Zalo/Chat hỗ trợ 7 ngày/tuần",
      "Backup dữ liệu tự động mỗi 6h",
    ],
    cta: "Chọn Pro",
    highlight: true,
    sampleData: { tables: 12, menuItems: 18, waiters: 3, kitchens: 2, pastOrders: 6 },
  },
  ENTERPRISE: {
    tier: "ENTERPRISE",
    label: "Enterprise",
    priceVND: 0,
    priceLabel: "Liên hệ",
    tagline: "Chuỗi > 5 chi nhánh",
    limits: {
      maxTables: INF,
      maxNonAdminStaff: INF,
      features: {
        vietQR: true,
        advancedReports: true,
        multiBranch: true,
        customBranding: true,
        apiAccess: true,
        prioritySupport: true,
      },
    },
    bullets: [
      "Bàn & nhân viên không giới hạn",
      "Multi-branch dashboard tổng hợp toàn chuỗi",
      "Custom branding trắng nhãn trên hoá đơn",
      "API tích hợp với hệ thống kế toán của bạn",
      "Dedicated account manager · SLA 99.9%",
      "On-site training & migration hỗ trợ",
    ],
    cta: "Nói chuyện với Sale",
    sampleData: { tables: 15, menuItems: 18, waiters: 3, kitchens: 2, pastOrders: 8 },
  },
};

export function planOf(tier: string | null | undefined): PlanConfig {
  if (!tier) return PLANS.TRIAL;
  return PLANS[tier as PlanTier] ?? PLANS.TRIAL;
}

export function canAddTable(currentCount: number, tier: string) {
  const p = planOf(tier);
  return currentCount < p.limits.maxTables;
}

export function canAddStaff(currentNonAdminCount: number, tier: string, newRole: "ADMIN" | "WAITER" | "KITCHEN") {
  if (newRole === "ADMIN") return true; // admins not capped
  const p = planOf(tier);
  return currentNonAdminCount < p.limits.maxNonAdminStaff;
}
