"use client";
// Page footer on scrolling pages: «Поддержать развитие проекта» and the test-version disclaimer.
// «Лента» is a fixed full-height page, so it carries the disclaimer in the bottom band instead (TabBar).
import { usePathname } from "next/navigation";
import { SupportBlock } from "@/components/SupportBlock";

export const DISCLAIMER =
  "Тестовая версия платформы. Все трейлеры и промо-материалы принадлежат их законным правообладателям и размещены исключительно в ознакомительных и демонстрационных целях.";

export function SiteFooter() {
  if (usePathname() === "/trailers") return null;
  return (
    <footer className="mx-auto max-w-page px-gutter pt-6 pb-8">
      <div className="flex flex-col gap-6 border-t border-line pt-6">
        <SupportBlock />
        <p className="max-w-[80ch] text-[13px] leading-relaxed text-muted">{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
