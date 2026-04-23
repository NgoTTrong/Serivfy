import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import { DialogProvider } from "@/components/DialogProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Servify — Quét. Chọn. Thưởng thức.",
  description:
    "QR-based table ordering cho nhà hàng Việt. Khách quét QR, gọi món chung, bếp nhận đơn real-time.",
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23f0630b'/%3E%3Cpath d='M6 6h8v8H6V6zm0 12h8v8H6v-8zM16 6h8v8h-8V6zm0 14h3v3h-3v-3zm4 0h3v3h-3v-3zm0 4h3v1h-3v-1z' fill='white'/%3E%3C/svg%3E",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700;800&family=Be+Vietnam+Pro:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NextTopLoader
          color="#f0630b"
          height={3}
          showSpinner={false}
          shadow="0 0 12px #ff7d15, 0 0 6px #ff7d15"
          easing="ease"
          speed={250}
        />
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
