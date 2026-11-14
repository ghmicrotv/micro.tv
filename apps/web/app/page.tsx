"use client";
// «Кинотеатр»: hero «Трейлер недели», «Новое в библиотеке» strip and «Катушки».
// The header filters (kind, time, genres) narrow «Новое в библиотеке»; the hero is the admin's pick.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, plural, type Home } from "@/lib/api";
import { useSaveToggle } from "@/lib/useSaveToggle";
import { filtersHref, readFeedParams, titleFeedHref, titleHref } from "@/lib/feedParams";
import { fitBadge } from "@/lib/episodes";
import { useToast } from "@/components/ui/Toast";
import { Art } from "@/components/film/Art";
import { FilmStrip, SprocketsV } from "@/components/film/FilmStrip";
import { PosterCard } from "@/components/film/PosterCard";

export default function LibraryPage() {
  return (
    // useSearchParams needs a Suspense boundary
    <Suspense>
      <Library />
    </Suspense>
  );
}

function Library() {
  const { kind, time, genres } = readFeedParams(useSearchParams());
  const genresKey = genres.join(",");
  const [data, setData] = useState<Home | null>(null);
  const [failed, setFailed] = useState(false);
  const toast = useToast();
  const saveToggle = useSaveToggle();

  // Refetch on filter change; the old content stays on screen until the new one arrives.
  useEffect(() => {
    api.home({ kind, maxMin: time, genres: genresKey ? genresKey.split(",") : [] }).then(setData, () => setFailed(true));
  }, [kind, time, genresKey]);

  if (failed) return <LoadError />;
  if (!data) return <main className="min-h-screen" aria-busy="true" />;

  const hero = data.hero;
  return (
    <main className="pb-section">
      {/* Phones: search as a bar under the header (the header is full with filters); desktop has a header button */}
      <div className="px-gutter pt-2 md:hidden">
        <button
          type="button"
          onClick={() => toast("Поиск появится в следующей версии")}
          className="flex h-11 w-full items-center gap-2.5 rounded-full bg-surface px-4 text-left text-[15px] text-muted transition-colors hover:bg-surface-hover"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          Поиск фильмов и сериалов
        </button>
      </div>
      {hero && (
        <section aria-labelledby="hero" className="mx-auto flex max-w-page flex-wrap items-center gap-16 px-gutter pt-4 md:pt-8">
          <div className="min-w-0 flex-[1_1_520px]">
            <p className="font-semibold text-accent">
              {["Трейлер недели", hero.title.genre, hero.title.runtime, hero.title.age_rating].filter(Boolean).join(" · ")}
            </p>
            <h1 id="hero" className="mt-4 text-hero font-extrabold text-balance">{hero.title.title}</h1>
            <p className="mt-5 max-w-[36ch] text-lg text-ink-soft md:mt-7 md:text-xl">{hero.title.logline}</p>
            <div className="mt-7 flex flex-wrap gap-3 md:mt-9">
              <Link
                href={titleFeedHref(hero.title)}
                className="inline-flex h-14 items-center gap-2.5 rounded-btn bg-accent px-7 font-bold text-on-accent no-underline transition-colors hover:bg-accent-hover"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
                Смотреть трейлер
              </Link>
              <button
                type="button"
                aria-pressed={hero.in_watchlist}
                onClick={() =>
                  saveToggle("watchlist", hero.title.id, !hero.in_watchlist, (v) =>
                    setData((d) => d && d.hero && { ...d, hero: { ...d.hero, in_watchlist: v } }),
                  )
                }
                className={`h-14 rounded-btn px-[26px] font-semibold transition-colors ${
                  hero.in_watchlist ? "bg-accent text-on-accent" : "bg-surface text-ink hover:bg-surface-hover"
                }`}
              >
                {hero.in_watchlist ? "В списке" : "Хочу посмотреть"}
              </button>
              <Link
                href={titleHref(hero.title)}
                className="inline-flex h-14 items-center rounded-btn border-2 border-ink/40 px-[26px] font-semibold text-ink no-underline transition-colors hover:border-ink"
              >
                {hero.title.kind === "series" ? "О сериале" : "О фильме"}
              </Link>
            </div>
          </div>

          {/* Vertical film strip: the middle frame is the hero's key art. Desktop only. */}
          <div aria-hidden className="relative hidden h-[560px] md:flex flex-[0_0_340px] flex-col gap-3.5 overflow-hidden rounded-strip bg-surface px-[34px]">
            <SprocketsV count={22} gap="14px" hole="h-[18px] w-3.5 rounded-[3px]" className="left-2.5 pt-2.5" />
            <SprocketsV count={22} gap="14px" hole="h-[18px] w-3.5 rounded-[3px]" className="right-2.5 pt-2.5" />
            <Art art={{ bg: "#3B2BFF", ink: "", shape: "width:46%;height:200%;left:30%;top:-50%;background:rgba(255,255,255,.2);transform:rotate(18deg)" }} className="-mt-10 h-[90px] flex-none rounded-frame" />
            <Art art={hero.art} className="h-[400px] flex-none rounded-frame">
              {hero.title.poster && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero.title.poster} alt="" className="absolute inset-0 size-full object-cover" />
              )}
            </Art>
            <Art art={{ bg: "#2A0F2E", ink: "", shape: "left:0;right:0;top:30%;height:30%;background:#FF4FB8" }} className="h-[90px] flex-none rounded-frame" />
          </div>
        </section>
      )}

      <section aria-labelledby="new" className="mt-section">
        <div className="mx-auto flex max-w-page items-end justify-between gap-4 px-gutter">
          <h2 id="new" className="text-h2 font-bold">Новое в библиотеке</h2>
          <button
            type="button"
            onClick={() => toast("Полный каталог появится в следующей версии")}
            className="font-semibold whitespace-nowrap text-accent transition-colors hover:text-accent-hover"
          >
            Весь каталог
          </button>
        </div>
        <div className="mt-5 md:mt-7">
          {data.new.length > 0 ? (
            <FilmStrip>
              {data.new.map((t) => (
                <PosterCard key={t.id} title={t} badge={fitBadge(t, time)} />
              ))}
            </FilmStrip>
          ) : (
            <p className="mx-auto max-w-page px-gutter text-muted">
              Под эти фильтры ничего нет.{" "}
              <Link href={filtersHref("/", { kind })}>Сбросить время и жанры</Link>
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="reels" className="mx-auto mt-section max-w-page px-gutter">
        <h2 id="reels" className="text-h2 font-bold">Катушки</h2>
        <p className="mt-2 text-base text-muted md:text-[19px]">Подборки, которые можно смотреть одной лентой.</p>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:mt-10 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] md:gap-x-6 md:gap-y-10">
          {data.reels.map((r) => (
            <Link
              key={r.slug}
              href={`/trailers?reel=${r.slug}`}
              className="reel flex flex-col items-center gap-3 text-center text-ink no-underline md:gap-[18px]"
            >
              <span
                className="ring relative block size-[136px] rounded-full border-[7px] border-accent md:size-[200px] md:border-[10px]"
                style={{ background: r.bg }}
              >
                {/* hub + four spool holes, in % of the inner circle so the reel scales */}
                {[[43.9, 43.9, 12.2], [39.4, 7.8, 21.1], [39.4, 71.1, 21.1], [7.8, 39.4, 21.1], [71.1, 39.4, 21.1]].map(([l, t, s]) => (
                  <span key={`${l}-${t}`} className="absolute rounded-full bg-ground" style={{ left: `${l}%`, top: `${t}%`, width: `${s}%`, height: `${s}%` }} />
                ))}
              </span>
              <span>
                <span className="block text-[17px] leading-tight font-bold md:text-[21px] md:leading-normal">{r.name}</span>
                <span className="text-muted">
                  {r.count} {plural(r.count, ["история", "истории", "историй"])}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function LoadError() {
  return (
    <main className="mx-auto max-w-page px-gutter pt-16">
      <h1 className="text-h2 font-bold">Не удалось загрузить</h1>
      <p className="mt-3 text-muted">Проверьте, что API запущен: <code>cd apps/api && go run ./cmd/api</code></p>
    </main>
  );
}
