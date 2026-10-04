import type { Metadata } from "next";
import { Inter, Noto_Nastaliq_Urdu, Poppins } from "next/font/google";
import { Toaster } from "sonner";

import { I18nProvider } from "@/lib/i18n/client";
import { getLang, getT } from "@/lib/i18n/server";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
// Only downloaded when the page is in Urdu (globals.css uses it under html[lang="ur"]).
const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-nastaliq",
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: { default: "GetPatang", template: "%s · GetPatang" },
    description: t("Pakistan's home for kite shops, organised tournaments, events and the kite-flying community."),
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  const dir = lang === "ur" ? "rtl" : "ltr";
  return (
    <html lang={lang} dir={dir} className={`${inter.variable} ${poppins.variable} ${nastaliq.variable}`}>
      <body className="min-h-dvh">
        <I18nProvider lang={lang}>
          {children}
          <Toaster position="top-center" richColors closeButton dir={dir} />
        </I18nProvider>
      </body>
    </html>
  );
}
