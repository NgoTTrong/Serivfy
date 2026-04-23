export function formatVND(n: number): string {
  // Brand format: comma separator as per Servify guideline (1,000,000đ)
  return `${n.toLocaleString("en-US")}đ`;
}

export function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("vi-VN");
}

export function waitMinutes(createdAt: Date | string): number {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.floor(ms / 60000);
}
