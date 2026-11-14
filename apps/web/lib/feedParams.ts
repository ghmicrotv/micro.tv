// The feed's filters live in the URL (/trailers?kind=series&time=15&genres=Драма,Нуар&reel=…),
// so the header controls and the feed page share them and they survive a reload.
import type { TitleCard } from "@/lib/api";

export type FeedParams = {
  kind: TitleCard["kind"]; // «Короткометражки» = film, «Микро-сериалы» = series
  time: number | null; // «Сколько свободного времени», minutes
  genres: string[];
  reel?: string;
  title?: string; // start at this title's trailer
};

type Readable = { get(name: string): string | null };

export function readFeedParams(p: Readable): FeedParams {
  const time = Number(p.get("time"));
  return {
    kind: p.get("kind") === "series" ? "series" : "film",
    time: Number.isInteger(time) && time > 0 ? time : null,
    genres: (p.get("genres") ?? "").split(",").map((g) => g.trim()).filter(Boolean),
    reel: p.get("reel") ?? undefined,
    title: p.get("title") ?? undefined,
  };
}

/** URL for `path` with the given filters (the same params work on «Кинотеатр» `/` and «Лента» `/trailers`). */
export function filtersHref(path: string, f: Partial<FeedParams>): string {
  const q = new URLSearchParams();
  if (f.kind === "series") q.set("kind", "series");
  if (f.time) q.set("time", String(f.time));
  if (f.genres?.length) q.set("genres", f.genres.join(","));
  if (f.reel) q.set("reel", f.reel);
  if (f.title) q.set("title", f.title);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export function feedHref(f: Partial<FeedParams>): string {
  return filtersHref("/trailers", f);
}

/** The title page: /films/{slug} or /series/{slug}. */
export function titleHref(t: Pick<TitleCard, "slug" | "kind">): string {
  return `/${t.kind === "series" ? "series" : "films"}/${t.slug}`;
}

/** Link to a title's trailer in the feed, with the matching kind selected. */
export function titleFeedHref(t: Pick<TitleCard, "slug" | "kind">): string {
  return feedHref({ kind: t.kind, title: t.slug });
}
