import Link from "next/link";
import QRCode from "qrcode";
import { Reveal } from "@/components/landing/Reveal";
import { Counter } from "@/components/landing/Counter";
import { StickyHeader } from "@/components/landing/StickyHeader";
import { FaqItem } from "@/components/landing/FaqItem";

export default async function LandingPage() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const demoQrUrl = `${baseUrl}/table/qr_ban_1_quan-ba-noi`;
  const qrSvg = await QRCode.toString(demoQrUrl, {
    type: "svg",
    margin: 0,
    width: 320,
    color: { dark: "#f0630b", light: "#00000000" },
  });

  return (
    <main className="overflow-hidden">
      <StickyHeader />

      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white px-6 pb-24 pt-8 md:px-12 md:pb-32 md:pt-20">
        {/* Animated blobs */}
        <div className="pointer-events-none absolute -left-32 top-10 -z-10 h-96 w-96 rounded-full bg-brand-300/40 blur-3xl animate-gradient-mesh" />
        <div className="pointer-events-none absolute -right-32 top-40 -z-10 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl animate-gradient-mesh" style={{ animationDelay: "3s" }} />

        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-1.5 text-xs font-medium text-brand-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulsebar" />
              Đang nhận đăng ký dùng thử miễn phí
            </div>
            <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight text-ink-950 md:text-7xl">
              Quét. Chọn.<br />
              <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
                Thưởng thức.
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-ink-700">
              <span className="font-semibold text-ink-950">Servify</span> là hệ thống gọi
              món bằng mã QR cho nhà hàng Việt. Khách tự order, bếp nhận ngay, phục vụ tick
              từng món — không cần bút, không nhầm bàn, không mất đơn.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-7 py-4 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/40"
              >
                Dùng thử miễn phí
                <span className="transition group-hover:translate-x-1">→</span>
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-300 bg-white px-7 py-4 font-semibold text-ink-900 transition hover:border-ink-500 hover:-translate-y-0.5"
              >
                🎬 Xem demo trực tiếp
              </a>
            </div>

            <div className="mt-8 flex items-center gap-5 text-sm">
              <div className="flex -space-x-2">
                {["🧑‍🍳", "👩‍🦰", "👨", "👩", "🧔"].map((e, i) => (
                  <span
                    key={i}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-brand-100 text-sm"
                  >
                    {e}
                  </span>
                ))}
              </div>
              <div>
                <div className="font-semibold text-ink-950">
                  <Counter to={500} suffix="+" /> quán Việt tin dùng
                </div>
                <div className="flex items-center gap-1 text-xs text-ink-500">
                  <span className="text-amber-500">★★★★★</span>
                  <span>4.9/5 trên App Review</span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Phone mockup */}
          <Reveal delay={150}>
            <div className="relative mx-auto w-full max-w-sm">
              <div className="absolute -inset-10 -z-10 bg-gradient-to-tr from-brand-300/50 via-brand-100/20 to-transparent blur-3xl" />
              <div className="animate-float rounded-[2.5rem] border-[10px] border-ink-950 bg-ink-950 shadow-2xl shadow-ink-950/30">
                <div className="rounded-[1.9rem] bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-ink-500">Quán Bà Nội</div>
                      <div className="font-display text-xl font-bold">Bàn 5</div>
                    </div>
                    <div className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
                      4 khách
                    </div>
                  </div>
                  <MockDish name="Phở bò tái" price="75,000đ" by="Minh" qty={2} />
                  <MockDish name="Bún chả Hà Nội" price="70,000đ" by="Lan" qty={1} />
                  <MockDish name="Trà đá" price="5,000đ" by="Minh" qty={4} />
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-brand-600 px-4 py-3 text-white">
                    <div>
                      <div className="text-xs opacity-80">Tổng đơn</div>
                      <div className="font-bold">240,000đ</div>
                    </div>
                    <button className="rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-700">
                      Gửi Order
                    </button>
                  </div>
                </div>
              </div>
              {/* Floating bubbles */}
              <div
                className="absolute -right-6 top-10 rounded-2xl bg-white px-3 py-2 text-xs font-semibold shadow-xl animate-float"
                style={{ animationDelay: "1s" }}
              >
                <span className="text-green-600">✓</span> Bếp đã nhận đơn
              </div>
              <div
                className="absolute -left-8 bottom-24 rounded-2xl bg-white px-3 py-2 text-xs font-semibold shadow-xl animate-float"
                style={{ animationDelay: "2.2s" }}
              >
                <span className="text-brand-600">🛎️</span> Phục vụ đang mang ra
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* LOGO MARQUEE */}
      <section className="border-y border-ink-100 bg-white py-8">
        <div className="mx-auto max-w-6xl px-6 md:px-12">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-ink-500">
            Đang phục vụ hàng trăm quán ăn Việt Nam
          </p>
        </div>
        <div className="mask-fade-x relative mt-6 overflow-hidden">
          <div className="flex w-max animate-marquee-slow gap-10 whitespace-nowrap px-6 text-ink-400">
            {[...LOGOS, ...LOGOS].map((l, i) => (
              <div key={i} className="inline-flex items-center gap-2 text-lg">
                <span>{l.icon}</span>
                <span className="font-display text-xl font-bold">{l.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-gradient-to-b from-white to-brand-50/40 px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
                Con số nói hơn lời
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold text-ink-950 md:text-5xl">
                Chủ quán quay lại vì điều này.
              </h2>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 100}>
                <StatTile {...s} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-white px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
                Bốn mảnh ghép — một hệ thống
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold text-ink-950 md:text-5xl">
                Toàn bộ hành trình bữa ăn,
                <br className="hidden md:block" /> liền mạch.
              </h2>
            </div>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <Feature {...f} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
                Đơn giản đến mức gây nghi ngờ
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold text-ink-950 md:text-5xl">
                Ba bước. Không hơn.
              </h2>
            </div>
          </Reveal>
          <div className="mt-10 space-y-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <Step {...s} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="bg-ink-50 px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
                So sánh thẳng thắn
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold text-ink-950 md:text-5xl">
                Giấy bút vs Servify
              </h2>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-ink-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 text-2xl">📝</span>
                  <h3 className="font-display text-xl font-bold text-ink-600">Giấy bút truyền thống</h3>
                </div>
                <ul className="space-y-2 text-sm text-ink-600">
                  {COMPARE_OLD.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="flex-none text-red-500">✕</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative rounded-3xl border-2 border-brand-500 bg-gradient-to-br from-brand-50 to-white p-6 shadow-xl shadow-brand-200/50">
                <div className="absolute -top-3 right-6 rounded-full bg-brand-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                  Servify
                </div>
                <div className="mb-4 flex items-center gap-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-2xl text-white">⚡</span>
                  <h3 className="font-display text-xl font-bold text-ink-950">Servify</h3>
                </div>
                <ul className="space-y-2 text-sm text-ink-700">
                  {COMPARE_NEW.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="flex-none text-green-600">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-white px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
                Minh bạch · không phí ẩn
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold text-ink-950 md:text-5xl">
                Bảng giá
              </h2>
              <p className="mt-3 text-ink-600">
                Dùng thử 14 ngày miễn phí · Huỷ lúc nào cũng được · Không yêu cầu thẻ
              </p>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PRICING.map((p, i) => (
              <Reveal key={p.name} delay={i * 120}>
                <PricingCard {...p} />
              </Reveal>
            ))}
          </div>
          <Reveal delay={400}>
            <p className="mt-6 text-center text-xs text-ink-500">
              Giá đã gồm VAT · Đơn vị: VND/tháng · Thanh toán theo tháng hoặc năm (giảm 20%)
            </p>
          </Reveal>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-gradient-to-b from-brand-50/60 to-white px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
                Từ chính chủ quán
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold text-ink-950 md:text-5xl">
                Dùng rồi không quay lại giấy bút được.
              </h2>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 120}>
                <TestimonialCard {...t} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section id="demo" className="bg-ink-950 px-6 py-20 text-white md:px-12 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">
                Trải nghiệm 60 giây
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">
                Giơ điện thoại lên, quét thử đi.
              </h2>
              <p className="mt-5 text-ink-300">
                Đây là QR của <span className="font-semibold text-white">Bàn 1</span> tại quán demo <span className="font-semibold text-white">Quán Bà Nội</span>. Quét bằng camera điện thoại — bạn sẽ thấy đúng những gì khách hàng thấy khi ngồi xuống bàn: menu đẹp, giỏ hàng chung, đặt món trong 3 chạm.
              </p>
              <div className="mt-8 space-y-2">
                <DemoLink
                  href="/table/qr_ban_1_quan-ba-noi"
                  label="Không có điện thoại? Mở trực tiếp"
                  sub="Chạy customer flow ngay trên browser này"
                />
                <DemoLink
                  href="/signup"
                  label="Hoặc đăng nhập thử quản lý"
                  sub="Admin · Waiter · Kitchen — pass 123456"
                />
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="relative">
                <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-tr from-brand-600/30 via-brand-400/10 to-transparent blur-3xl" />
                <div className="mx-auto max-w-md rounded-[2rem] border border-ink-800 bg-gradient-to-br from-ink-900 to-ink-950 p-8 shadow-2xl shadow-brand-600/20">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-brand-400">
                        Quán Bà Nội
                      </div>
                      <div className="font-display text-2xl font-bold text-white">Bàn 1</div>
                    </div>
                    <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                      Đang mở
                    </span>
                  </div>
                  <div className="mt-6 flex items-center justify-center rounded-3xl bg-white p-6">
                    <div
                      className="aspect-square w-full max-w-[260px] [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  </div>
                  <div className="mt-5 flex items-start gap-3 rounded-xl bg-ink-900 p-3 text-sm">
                    <span className="text-2xl">📷</span>
                    <div>
                      <div className="font-semibold text-white">Mở camera điện thoại</div>
                      <div className="text-xs text-ink-400">
                        Hướng vào mã QR trên màn hình → nhấn vào link hiện lên.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
                Giải đáp nhanh
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold text-ink-950 md:text-5xl">
                Câu hỏi thường gặp
              </h2>
            </div>
          </Reveal>
          <div className="mt-10 space-y-3">
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <FaqItem q={f.q} a={f.a} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-20 text-white md:px-12 md:py-28">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-20" aria-hidden>
          <div className="absolute -top-20 left-1/4 h-96 w-96 rounded-full bg-amber-400 blur-3xl animate-gradient-mesh" />
          <div className="absolute -bottom-20 right-1/4 h-96 w-96 rounded-full bg-brand-300 blur-3xl animate-gradient-mesh" style={{ animationDelay: "4s" }} />
        </div>
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-4xl font-bold leading-tight md:text-6xl">
              Sẵn sàng để khách tự order trong <span className="underline decoration-amber-300 decoration-4 underline-offset-4">5 phút</span>?
            </h2>
            <p className="mt-5 text-lg text-white/85">
              Đăng ký miễn phí, không cần thẻ. Bạn cài xong trước khi ly cà phê sáng nguội.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-bold text-brand-700 shadow-2xl transition hover:-translate-y-0.5 hover:bg-ink-50"
              >
                Bắt đầu miễn phí →
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 rounded-full border-2 border-white/50 px-8 py-4 font-semibold text-white transition hover:bg-white/10"
              >
                Xem bảng giá
              </a>
            </div>
            <p className="mt-5 text-xs text-white/70">
              ✓ Thiết lập &lt; 5 phút · ✓ Không phí setup · ✓ Huỷ lúc nào cũng được
            </p>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-ink-100 bg-white px-6 py-12 md:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <Logo />
              <p className="mt-4 max-w-xs text-sm text-ink-600">
                Hệ thống gọi món QR cho nhà hàng Việt. Made with ❤️ ở Sài Gòn.
              </p>
              <div className="mt-4 flex gap-2">
                <SocialButton icon="📘" label="Facebook" />
                <SocialButton icon="📸" label="Instagram" />
                <SocialButton icon="📺" label="YouTube" />
                <SocialButton icon="💬" label="Zalo" />
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                Sản phẩm
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-ink-700">
                <li><a href="#features" className="hover:text-brand-600">Tính năng</a></li>
                <li><a href="#how" className="hover:text-brand-600">Cách dùng</a></li>
                <li><a href="#pricing" className="hover:text-brand-600">Bảng giá</a></li>
                <li><a href="#demo" className="hover:text-brand-600">Demo trực tiếp</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                Hỗ trợ
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-ink-700">
                <li><a href="#faq" className="hover:text-brand-600">FAQ</a></li>
                <li><a href="mailto:hi@servify.vn" className="hover:text-brand-600">hi@servify.vn</a></li>
                <li><a href="tel:0909999888" className="hover:text-brand-600">0909 999 888</a></li>
                <li><a href="#" className="hover:text-brand-600">Hướng dẫn setup</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                Pháp lý
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-ink-700">
                <li><a href="#" className="hover:text-brand-600">Điều khoản dịch vụ</a></li>
                <li><a href="#" className="hover:text-brand-600">Chính sách bảo mật</a></li>
                <li><a href="#" className="hover:text-brand-600">Chính sách hoàn tiền</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-ink-100 pt-6 text-sm text-ink-500 md:flex-row">
            <div>© {new Date().getFullYear()} Servify · Made in Vietnam 🇻🇳</div>
            <div>Phiên bản 0.1.0 — Beta</div>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ----------------------------- Data ----------------------------- */

const LOGOS = [
  { name: "Phở Bát Đàn", icon: "🍜" },
  { name: "Cơm tấm Sài Gòn", icon: "🍚" },
  { name: "Bún Chả Sinh Từ", icon: "🥢" },
  { name: "Cafe Miền Tây", icon: "☕" },
  { name: "Lẩu Anh Hai", icon: "🍲" },
  { name: "Quán Gà Nướng", icon: "🍗" },
  { name: "Chè Cô Ba", icon: "🍧" },
  { name: "Bánh Mì 37", icon: "🥖" },
];

const STATS = [
  { to: 80, suffix: "%", label: "Giảm lỗi đơn", sub: "So với ghi giấy bút", icon: "✓" },
  { to: 25, suffix: "%", label: "Tăng doanh thu", sub: "Trung bình tháng đầu", icon: "📈" },
  { to: 5, suffix: "p", label: "Setup trong", sub: "Không cần training", icon: "⚡" },
  { to: 500, suffix: "+", label: "Quán tin dùng", sub: "Trên toàn Việt Nam", icon: "🏪" },
];

const FEATURES = [
  {
    icon: "📱",
    title: "Khách hàng",
    body:
      "Quét QR là vào menu. Không app, không tài khoản. Giỏ hàng chung toàn bàn — ai thêm món, mọi người thấy ngay.",
  },
  {
    icon: "🍳",
    title: "KDS bếp",
    body:
      "Màn hình chỉ đọc, tự nhận đơn. Card đổi màu theo thời gian chờ: xanh → vàng → đỏ. Chuông kêu khi có order mới.",
  },
  {
    icon: "🛎️",
    title: "Nhân viên",
    body:
      "Tablet cầm tay. Tick ✓ từng món đã phục vụ. Khi hết → round tự chuyển SERVED. Đóng bàn sau khi tính tiền.",
  },
  {
    icon: "🏪",
    title: "Chủ quán",
    body:
      "Dashboard doanh thu realtime. CRUD menu, bàn, nhân viên. Tạo & tải QR code PNG/SVG cho từng bàn.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Khách quét QR dán trên bàn",
    body:
      "Mã QR cố định cho mỗi bàn. Hệ thống tự mở session mới hoặc nối vào session đang có — không trùng đơn.",
  },
  {
    n: "02",
    title: "Cả bàn chọn món — bếp làm ngay",
    body:
      "Giỏ hàng realtime sync giữa các điện thoại. Bấm Gửi Order → bếp nhận qua KDS. Không lặp bàn, không nhầm món.",
  },
  {
    n: "03",
    title: "Thu ngân, in bill — đóng bàn",
    body:
      "Thu ngân chọn PTTT (tiền mặt / chuyển khoản VietQR / thẻ) → in hoá đơn → đóng bàn. Sẵn sàng cho khách tiếp theo.",
  },
];

const COMPARE_OLD = [
  "Phục vụ chạy đi chạy lại 3-4 lượt, ghi sai tên món",
  "Bếp không biết đơn mới tới — kêu hỏi qua bộ đàm",
  "Khách gọi thêm phải đợi phục vụ rảnh",
  "Tính tiền cộng tay, sai 10k/ngày",
  "Muốn xem doanh thu hôm qua → đếm giấy",
  "Mất giấy là mất đơn, không có backup",
];

const COMPARE_NEW = [
  "Khách tự order qua QR — phục vụ chỉ lo mang ra",
  "Bếp thấy đơn ngay khi khách bấm Gửi",
  "Khách gọi thêm từ chính điện thoại, không đợi",
  "Hoá đơn tự cộng, VietQR auto — không lỗi số",
  "Dashboard doanh thu realtime, so sánh theo giờ/ngày",
  "Mọi dữ liệu đều trên cloud — khó mất",
];

const PRICING = [
  {
    name: "Starter",
    price: "199,000đ",
    period: "/ tháng",
    desc: "Cho quán đơn, 1 điểm bán",
    features: [
      "15 bàn · 5 nhân viên",
      "VietQR + in hoá đơn",
      "KDS bếp + tablet phục vụ",
      "Email hỗ trợ 5 ngày/tuần",
      "Xuất doanh thu CSV theo ngày",
    ],
    cta: "Chọn Starter",
    highlight: false,
  },
  {
    name: "Pro",
    price: "499,000đ",
    period: "/ tháng",
    desc: "Quán vừa tới chuỗi nhỏ",
    features: [
      "50 bàn · nhân viên không giới hạn",
      "Báo cáo nâng cao (trend, món bán chạy)",
      "Custom branding trên hoá đơn",
      "Zalo/Chat hỗ trợ 7 ngày/tuần",
      "Backup dữ liệu tự động 6h/lần",
    ],
    cta: "Chọn Pro",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Liên hệ",
    period: "",
    desc: "Chuỗi > 5 chi nhánh",
    features: [
      "Bàn & nhân viên không giới hạn",
      "Multi-branch dashboard tổng hợp",
      "API tích hợp kế toán",
      "Dedicated account manager",
      "SLA 99.9% · On-site training",
    ],
    cta: "Nói chuyện với Sale",
    highlight: false,
  },
];

const TESTIMONIALS = [
  {
    name: "Chị Hoa",
    role: "Chủ Quán Bà Nội · Q.1",
    quote:
      "Trước mỗi ca đứng đếm giấy order, giờ mở dashboard là biết luôn bàn nào sắp xong. Nhân viên cũng đỡ cãi nhau vì lộn bàn.",
    avatar: "👩",
    tone: "bg-brand-100 text-brand-700",
  },
  {
    name: "Anh Nam",
    role: "Chủ Phở Bát Đàn · Hà Nội",
    quote:
      "Bếp nhận đơn qua KDS, chuông kêu là biết — không cần la hét trong bếp nữa. Khách đông giờ cao điểm mà không loạn.",
    avatar: "👨",
    tone: "bg-blue-100 text-blue-700",
  },
  {
    name: "Chị Linh",
    role: "Chuỗi Cafe 3 chi nhánh",
    quote:
      "Chi phí 299k/tháng rẻ hơn 1 ca phục vụ sai đơn. VietQR tự tạo giúp mẹ tôi (chủ quán) nhận chuyển khoản nhanh hơn.",
    avatar: "💁‍♀️",
    tone: "bg-amber-100 text-amber-800",
  },
];

const FAQS = [
  {
    q: "Khách có cần cài app không?",
    a: "Không. Servify hoạt động 100% trên trình duyệt web. Khách quét QR bằng camera điện thoại là vào menu ngay — không đăng nhập, không cài đặt.",
  },
  {
    q: "Có cần thiết bị đặc biệt không?",
    a: "Không. Cần: 1 máy tính hoặc tablet cho bếp (KDS), 1 điện thoại/tablet cho phục vụ. Khách dùng chính điện thoại của họ. QR in ra giấy dán lên bàn là xong.",
  },
  {
    q: "Thanh toán hoạt động như thế nào?",
    a: "Servify hỗ trợ 3 phương thức: Tiền mặt, Chuyển khoản (VietQR tự tạo), và Thẻ (qua máy POS sẵn có). Không làm trung gian tiền — tiền khách trả trực tiếp cho quán.",
  },
  {
    q: "Mất internet thì sao?",
    a: "KDS và Waiter vẫn hiện đơn cũ — chỉ không nhận đơn mới tới khi có mạng lại. Khách sẽ thấy thông báo lỗi và đợi. Chúng tôi khuyến nghị có 4G backup.",
  },
  {
    q: "Dữ liệu có bảo mật không?",
    a: "Có. Mỗi quán tách biệt hoàn toàn (multi-tenant). Mật khẩu mã hoá bcrypt. HTTPS end-to-end. Backup tự động mỗi 6h. Tuân thủ quy định bảo vệ dữ liệu cá nhân VN.",
  },
  {
    q: "Có hỗ trợ setup không?",
    a: "Có — gói Pro có Zalo hỗ trợ 7 ngày/tuần. Chúng tôi hỗ trợ tạo menu, in QR, training nhân viên trong vòng 1 giờ qua video call.",
  },
  {
    q: "Hoàn tiền thế nào nếu không hài lòng?",
    a: "Hoàn tiền 100% trong 30 ngày đầu nếu không hài lòng, không cần giải thích. Dữ liệu của quán cũng được xuất ra để bạn giữ lại.",
  },
  {
    q: "Có gói dành cho chuỗi lớn không?",
    a: "Có — gói Enterprise cho chuỗi > 5 chi nhánh. Dashboard tổng hợp toàn chuỗi, API tuỳ chỉnh, SLA 99.9%, account manager riêng. Liên hệ sale để báo giá.",
  },
];

/* --------------------------- Components --------------------------- */

function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zM14 3h7v7h-7V3zm0 13h3v3h-3v-3zm4 0h3v3h-3v-3zm0 4h3v1h-3v-1z" />
        </svg>
      </span>
      <span className="font-display text-2xl font-bold tracking-tight text-ink-950">
        Servify
      </span>
    </Link>
  );
}

function StatTile({
  to,
  suffix,
  label,
  sub,
  icon,
}: {
  to: number;
  suffix: string;
  label: string;
  sub: string;
  icon: string;
}) {
  return (
    <div className="group rounded-3xl border border-ink-100 bg-white p-6 transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-200/40">
      <div className="flex items-start justify-between">
        <div className="font-display text-4xl font-bold text-ink-950 md:text-5xl">
          <Counter to={to} suffix={suffix} />
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-xl transition group-hover:scale-110 group-hover:bg-brand-100">
          {icon}
        </span>
      </div>
      <div className="mt-3 font-semibold text-ink-900">{label}</div>
      <div className="text-xs text-ink-500">{sub}</div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="group rounded-3xl border border-ink-100 bg-white p-7 transition duration-300 hover:-translate-y-1.5 hover:border-brand-200 hover:shadow-2xl hover:shadow-brand-300/40">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-3xl transition group-hover:scale-110 group-hover:bg-brand-100">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-xl font-bold text-ink-950">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="group flex flex-col gap-4 rounded-3xl border border-ink-100 bg-white p-7 transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-200/40 md:flex-row md:items-start md:gap-8">
      <div className="font-display text-5xl font-bold text-brand-200 transition group-hover:text-brand-400">
        {n}
      </div>
      <div>
        <h3 className="font-display text-2xl font-bold text-ink-950">{title}</h3>
        <p className="mt-2 text-ink-600">{body}</p>
      </div>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  desc,
  features,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  cta: string;
  highlight: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-3xl p-7 transition hover:-translate-y-1 ${
        highlight
          ? "border-2 border-brand-500 bg-gradient-to-b from-brand-50 to-white shadow-2xl shadow-brand-300/30"
          : "border border-ink-100 bg-white hover:shadow-xl"
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md">
          Phổ biến
        </div>
      )}
      <div className="text-sm font-semibold uppercase tracking-widest text-brand-600">
        {name}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <div className="font-display text-4xl font-bold text-ink-950 md:text-5xl">
          {price}
        </div>
        {period && <div className="text-sm text-ink-500">{period}</div>}
      </div>
      <p className="mt-2 text-sm text-ink-600">{desc}</p>
      <ul className="mt-6 flex-1 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="flex-none text-brand-600">✓</span>
            <span className="text-ink-700">{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`mt-7 inline-flex items-center justify-center rounded-full py-3 font-semibold transition ${
          highlight
            ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700"
            : "border border-ink-300 bg-white text-ink-900 hover:bg-ink-50"
        }`}
      >
        {cta} →
      </Link>
    </div>
  );
}

function TestimonialCard({
  name,
  role,
  quote,
  avatar,
  tone,
}: {
  name: string;
  role: string;
  quote: string;
  avatar: string;
  tone: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-ink-100 bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl">
      <div className="text-3xl text-brand-300">"</div>
      <p className="mt-2 flex-1 text-ink-800">{quote}</p>
      <div className="mt-5 flex items-center gap-3">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-xl ${tone}`}
        >
          {avatar}
        </span>
        <div>
          <div className="font-semibold text-ink-950">{name}</div>
          <div className="text-xs text-ink-500">{role}</div>
        </div>
      </div>
    </div>
  );
}

function DemoLink({ href, label, sub }: { href: string; label: string; sub?: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-2xl border border-ink-700 bg-ink-900 px-5 py-4 transition hover:border-brand-400 hover:bg-ink-800"
    >
      <div>
        <div className="font-semibold text-white">{label}</div>
        {sub && <div className="text-xs text-ink-400">{sub}</div>}
      </div>
      <span className="text-xl text-brand-400 transition group-hover:translate-x-1">→</span>
    </Link>
  );
}

function MockDish({ name, price, by, qty }: { name: string; price: string; by: string; qty: number }) {
  return (
    <div className="mt-2 flex items-center gap-3 rounded-2xl bg-ink-50 p-3">
      <div className="h-10 w-10 rounded-xl bg-brand-200 shimmer" />
      <div className="flex-1">
        <div className="flex items-baseline justify-between">
          <div className="font-medium text-ink-900">{name}</div>
          <div className="text-xs text-ink-500">×{qty}</div>
        </div>
        <div className="flex items-baseline justify-between text-xs">
          <div className="text-brand-600">by {by}</div>
          <div className="text-ink-500">{price}</div>
        </div>
      </div>
    </div>
  );
}

function SocialButton({ icon, label }: { icon: string; label: string }) {
  return (
    <a
      href="#"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-lg transition hover:scale-110 hover:bg-brand-100"
    >
      {icon}
    </a>
  );
}
