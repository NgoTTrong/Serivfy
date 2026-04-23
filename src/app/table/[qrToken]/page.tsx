import { redirect } from "next/navigation";
import { findOrCreateSessionForTable } from "@/lib/session-guard";

export const dynamic = "force-dynamic";

export default async function TableEntryPage({ params }: { params: { qrToken: string } }) {
  const result = await findOrCreateSessionForTable(params.qrToken);
  if (!result) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <div className="text-5xl">🚫</div>
          <h1 className="mt-4 font-display text-2xl font-bold">Không tìm thấy bàn</h1>
          <p className="mt-2 text-ink-600">Mã QR này không hợp lệ hoặc bàn đã bị xóa.</p>
        </div>
      </main>
    );
  }
  redirect(`/session/${result.session.token}`);
}
