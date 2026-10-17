import type { Metadata } from "next";
import { Inter, Noto_Nastaliq_Urdu, Poppins } from "next/font/google";
import { Toaster } from "sonner";

import { I18nProvider } from "@/lib/i18n/client";
import { getLang, getT } from "@/lib/i18n/server";
import { ThemeProvider } from "@/lib/theme";

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
    <html lang={lang} dir={dir} className={`${inter.variable} ${poppins.variable} ${nastaliq.variable}`} suppressHydrationWarning>
      <head>
        {/*
          Anti-flash script: runs BEFORE React hydrates.
          Reads localStorage and sets data-theme on <html> immediately
          so there is never a flash of the wrong colour scheme.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  try {
    var t = localStorage.getItem('gp-theme');
    var dark = t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme:dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch(e) {}
})();`,
          }}
        />
      </head>
      <body className="min-h-dvh">
        <ThemeProvider>
          <I18nProvider lang={lang}>
            {children}
            <Toaster position="top-center" richColors closeButton dir={dir} />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
