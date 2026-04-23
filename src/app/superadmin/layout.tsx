import type { Metadata } from "next";
import { getPlatformSession } from "@/lib/platform-auth";
import SuperShell from "./SuperShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Servify HQ — Platform Admin",
};

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getPlatformSession();
  return <SuperShell session={s}>{children}</SuperShell>;
}
