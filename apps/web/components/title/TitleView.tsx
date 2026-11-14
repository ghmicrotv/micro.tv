"use client";
// Title page («как на Кинопоиске»): poster, facts, actions, cast and «Похожие».
// Facts come from Kinopoisk where the title is listed; empty ones are simply not shown.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, type TitleCard, type TitleDetail } from "@/lib/api";
import { titleFeedHref } from "@/lib/feedParams";
import { useSaveToggle } from "@/lib/useSaveToggle";
import { useToast } from "@/components/ui/Toast";
import { Art } from "@/components/film/Art";
import { FilmStrip } from "@/components/film/FilmStrip";
import { PosterCard } from "@/components/film/PosterCard";

type Data = { title: TitleDetail; similar: TitleCard[]; in_watchlist: boolean };

export function TitleView({ slug }: { slug: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "failed">("loading");
  const router = useRouter();
  const toast = useToast();
  const saveToggle = useSaveToggle();

  useEffect(() => {
    setState("loading");
    api.title(slug).then(
      (d) => { setData(d); setState("ok"); },
      (e) => setState(e instanceof ApiError && e.status === 404 ? "missing" : "failed"),
    );
  }, [slug]);

  if (state === "loading") return <main className="min-h-screen" aria-busy="true" />;
  if (state !== "ok" || !data) {
    return (
      <main className="mx-auto max-w-page px-gutter pt-16">
        <h1 className="text-h2 font-bold">{state === "missing" ? "Такого фильма нет" : "Не удалось загрузить"}</h1>
        <Link href="/" className="mt-4 inline-block font-semibold">В кинотеатр</Link>
      </main>
    );
  }

  const t = data.title;
  const series = t.kind === "series";
  const facts: [string, string][] = [
    ["Год", t.year ? String(t.year) : ""],
    ["Страна", t.country],
    ["Жанр", t.genre],
    ["Режиссёр", t.director],
    ...(series
      ? ([["Серий", t.episodes ? String(t.episodes) : ""], ["Длительность серии", t.episode_length]] as [string, string][])
      : ([["Длительность", t.runtime]] as [string, string][])),
    ["Возраст", t.age_rating],
  ];

  return (
    <main className="pb-section">
      <div className="mx-auto max-w-page px-gutter pt-2 md:pt-6">
        <button type="button" onClick={() => router.back()} className="text-sm font-semibold text-muted hover:text-ink">
          ← Назад
        </button>

        <div className="mt-4 flex flex-col gap-8 md:mt-6 md:flex-row md:gap-14">
          {/* Poster */}
          <div className="w-[220px] flex-none self-center md:w-[300px] md:self-start">
            <Art art={t.art} className="aspect-[2/3] rounded-frame">
              {t.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.poster} alt={`Постер: ${t.title}`} className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="absolute inset-x-4 bottom-4 text-2xl leading-none font-extrabold">{t.title}</span>
              )}
            </Art>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-h1 font-extrabold text-balance">{t.title}</h1>
              {t.age_rating && (
                <span className="rounded-[4px] border border-ink/50 px-2 py-0.5 text-sm leading-none font-bold">{t.age_rating}</span>
              )}
            </div>
            {(t.original_title || t.year > 0) && (
              <p className="mt-2 text-muted">{[t.original_title, t.year || ""].filter(Boolean).join(", ")}</p>
            )}
            <p className="mt-4 font-semibold text-accent">
              {[series ? "Сериал" : "Фильм", t.genre, t.runtime].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-4 max-w-[60ch] text-lg text-ink-soft">{t.logline}</p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={titleFeedHref(t)}
                className="inline-flex h-[52px] items-center gap-2.5 rounded-btn bg-accent px-6 font-bold text-on-accent no-underline transition-colors hover:bg-accent-hover"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
                Смотреть трейлер
              </Link>
              <button
                type="button"
                aria-pressed={data.in_watchlist}
                onClick={() =>
                  saveToggle("watchlist", t.id, !data.in_watchlist, (v) => setData((d) => d && { ...d, in_watchlist: v }))
                }
                className={`h-[52px] rounded-btn px-6 font-semibold transition-colors ${
                  data.in_watchlist ? "bg-accent text-on-accent" : "bg-surface text-ink hover:bg-surface-hover"
                }`}
              >
                {data.in_watchlist ? "В списке" : "Хочу посмотреть"}
              </button>
              <button
                type="button"
                onClick={() => toast(series ? "Полные серии появятся в следующей версии" : "Полный фильм появится в следующей версии")}
                className="h-[52px] rounded-btn border-2 border-ink/40 px-6 font-semibold text-ink transition-colors hover:border-ink"
              >
                {series ? "Смотреть первую серию" : "Смотреть целиком"}
              </button>
            </div>

            {/* «О фильме» — like Kinopoisk's facts table */}
            <section aria-labelledby="about" className="mt-10">
              <h2 id="about" className="text-h3 font-bold">{series ? "О сериале" : "О фильме"}</h2>
              <dl className="mt-4 grid max-w-[640px] grid-cols-[minmax(120px,170px)_1fr] gap-x-6 gap-y-3">
                {facts.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {t.cast.length > 0 && (
              <section aria-labelledby="cast" className="mt-10">
                <h2 id="cast" className="text-h3 font-bold">В главных ролях</h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {t.cast.map((name) => (
                    <li key={name} className="rounded-full bg-surface px-4 py-2 text-[15px]">{name}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>

      {data.similar.length > 0 && (
        <section aria-labelledby="similar" className="mt-section">
          <h2 id="similar" className="mx-auto max-w-page px-gutter text-h2 font-bold">Похожие</h2>
          <div className="mt-5 md:mt-7">
            <FilmStrip>
              {data.similar.map((s) => <PosterCard key={s.id} title={s} />)}
            </FilmStrip>
          </div>
        </section>
      )}
    </main>
  );
}
