import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import Script from "next/script";
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

        {/* Yandex.Metrika counter */}
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=114365847", "ym");

            ym(114365847, "init", {
              ssr: true,
              webvisor: true,
              clickmap: true,
              ecommerce: "dataLayer",
              accurateTrackBounce: true,
              trackLinks: true
            });
          `}
        </Script>
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/114365847"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
      </body>
    </html>
  );
}
