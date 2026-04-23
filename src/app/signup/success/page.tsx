import Link from "next/link";

type Search = { status?: string; slug?: string; email?: string };

export default function SignupSuccess({ searchParams }: { searchParams: Search }) {
  const approved = searchParams.status === "APPROVED";
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-100 via-white to-brand-50 p-6">
      <div className="w-full max-w-lg rounded-3xl border border-ink-100 bg-white p-10 text-center shadow-2xl shadow-brand-300/30">
        <div className="text-6xl">{approved ? "🎉" : "📮"}</div>
        <h1 className="mt-5 font-display text-3xl font-bold text-ink-950">
          {approved ? "Tài khoản đã sẵn sàng!" : "Đã gửi yêu cầu"}
        </h1>
        <p className="mt-3 text-ink-600">
          {approved
            ? "Đội ngũ Servify đã kích hoạt tự động cho quán của bạn. Đăng nhập ngay để cài menu và in QR."
            : "Cảm ơn bạn đã đăng ký. Đội ngũ Servify sẽ duyệt & kích hoạt trong vòng 1 ngày làm việc. Email xác nhận sẽ được gửi đến:"}
        </p>
        {!approved && searchParams.email && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 font-mono text-sm text-brand-700">
            📧 {searchParams.email}
          </div>
        )}
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {approved && (
            <Link
              href="/admin/login"
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700"
            >
              Đăng nhập ngay →
            </Link>
          )}
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-ink-300 bg-white px-6 py-3 font-semibold text-ink-800 hover:bg-ink-50"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
