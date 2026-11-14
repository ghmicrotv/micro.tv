"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { FeedControls, FILTER_PAGES } from "@/components/feed/FeedControls";
import { useToast } from "@/components/ui/Toast";

/** Search is not in the prototype yet: the button only announces it. */
export function SearchButton({ className = "" }: { className?: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      aria-label="Поиск"
      title="Поиск"
      onClick={() => toast("Поиск появится в следующей версии")}
      className={`size-11 place-items-center rounded-full bg-surface text-ink transition-colors hover:bg-surface-hover ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </button>
  );
}

// Section tabs live in the bottom island (TabBar); the header holds the logo and, on «Кинотеатр»
// and «Лента», the filters (Короткометражки / Микро-сериалы, «Время», genres).
export function Header() {
  const path = usePathname();
  const withFilters = FILTER_PAGES.includes(path);

  return (
    <header className="mx-auto flex h-14 max-w-page items-center justify-between gap-1.5 px-gutter md:h-[88px] md:gap-8">
      <Link href="/" aria-label="Micro.tv" className="flex flex-none items-center gap-2.5 text-ink no-underline md:gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/logo.png" alt="" width={40} height={39} className={`md:h-[39px] md:w-10 ${withFilters ? "size-7" : "size-8"}`} />
        {/* On a phone the filters need the room, so the name gets a little smaller there */}
        <span className={`font-bold tracking-[.02em] md:text-2xl ${withFilters ? "text-lg" : "text-xl"}`}>Micro.tv</span>
      </Link>

      {withFilters ? (
        <div className="flex items-center gap-2">
          {/* useSearchParams inside needs a Suspense boundary */}
          <Suspense>
            <FeedControls />
          </Suspense>
          {/* Desktop search on «Кинотеатр»; on phones it is a bar under the header (no room here) */}
          {path === "/" && <SearchButton className="hidden md:grid" />}
        </div>
      ) : (
        <span className="w-10 md:w-12" />
      )}
    </header>
  );
}
