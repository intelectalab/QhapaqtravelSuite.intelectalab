import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import { NONCE_HEADER } from "@/lib/security-headers";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "KipuControl", template: "%s · KipuControl" },
  description: "Gestión integral para agencias de viajes y operadores turísticos.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Script id="theme-boot" strategy="beforeInteractive" nonce={nonce}>
          {THEME_BOOT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
