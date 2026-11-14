"use client";
// Bottom band (same role as the header at the top) with the tab island centered in it:
// icon-only section tabs, the active one in a lilac circle.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DISCLAIMER } from "@/components/SiteFooter";
import { useToast } from "@/components/ui/Toast";

const tabs = [
  { href: "/", label: "Кинотеатр", icon: "/icons/tab-films.png", size: 24 },
  { href: "/trailers", label: "Лента", icon: "/icons/tab-trailers.png", size: 24 },
  { href: "/profile", label: "Профиль", icon: "/icons/tab-profile.png", size: 19 },
];

export function TabBar() {
  const path = usePathname();
  const toast = useToast();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] items-center justify-center bg-ground pb-[env(safe-area-inset-bottom)]">
      {/* «Лента» has no page footer: the test-version disclaimer sits at the left of the band */}
      {path === "/trailers" && (
        <>
          <p className="absolute top-1/2 left-6 hidden max-w-[calc(50%-150px)] -translate-y-1/2 text-xs leading-snug text-muted lg:block">
            Тестовая версия. Трейлеры и промо-материалы принадлежат правообладателям и показаны в ознакомительных целях.
          </p>
          <button
            type="button"
            onClick={() => toast(DISCLAIMER)}
            aria-label="О тестовой версии"
            title="О тестовой версии"
            className="absolute top-1/2 left-4 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" />
            </svg>
          </button>
        </>
      )}
      <nav
        aria-label="Разделы"
        className="flex gap-5 rounded-full border border-line bg-surface px-3 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,.55)]"
      >
        {tabs.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-label={t.label}
              title={t.label}
              aria-current={active ? "page" : undefined}
              className={`grid size-11 place-items-center rounded-full no-underline transition-colors md:size-[52px] ${
                active ? "bg-accent text-on-accent" : "text-muted hover:bg-surface-hover hover:text-ink"
              }`}
            >
              <span
                aria-hidden
                className="mask-icon"
                style={{ width: t.size, height: t.size, maskImage: `url(${t.icon})`, WebkitMaskImage: `url(${t.icon})` }}
              />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
