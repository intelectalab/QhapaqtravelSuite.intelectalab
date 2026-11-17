import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import { LogoProvider } from "@/components/shell/BrandMark";
import { Toaster } from "@/components/ui/Toast";
import { logoIcon } from "@/lib/brand";
import { NONCE_HEADER } from "@/lib/security-headers";
import { currentLogo } from "@/lib/server/brand";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { default: "KipuControl", template: "%s · KipuControl" },
    description: "Gestión integral para agencias de viajes y operadores turísticos.",
    icons: { icon: { url: logoIcon(await currentLogo()), type: "image/svg+xml" } },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [nonce, logo] = await Promise.all([headers().then((list) => list.get(NONCE_HEADER) ?? undefined), currentLogo()]);
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Script id="theme-boot" strategy="beforeInteractive" nonce={nonce}>
          {THEME_BOOT_SCRIPT}
        </Script>
        <LogoProvider mark={logo}>{children}</LogoProvider>
        <Toaster />
      </body>
    </html>
  );
}
