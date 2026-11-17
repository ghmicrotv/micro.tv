import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { TabBar } from "@/components/TabBar";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const jost = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jost",
});

export const metadata: Metadata = {
  title: "Micro.tv — короткие фильмы и веб-сериалы",
  description: "Каталог короткого кино и веб-сериалов с вертикальной лентой трейлеров.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={jost.variable}>
      {/* Bottom padding = the tab band, so content never ends up under it */}
      <body className="pb-[var(--tabbar-h)]">
        <ToastProvider>
          <Header />
          {children}
          <SiteFooter />
          <TabBar />
        </ToastProvider>
      </body>
    </html>
  );
}
