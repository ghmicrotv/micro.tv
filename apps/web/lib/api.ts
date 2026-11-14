// Thin typed client for the Go API (same origin, proxied by next.config.ts).

export type Art = { bg: string; ink: string; shape: string };

export type TitleCard = {
  id: string;
  slug: string;
  kind: "film" | "series";
  title: string;
  genre: string;
  runtime: string;
  duration_min: number; // film length, or one episode for series
  logline: string;
  poster: string | null; // real poster (web path); null = abstract art
  age_rating: string; // «18+»
  episodes: number; // series only
  episode_seconds: number; // series only: one episode, for «Успеете N серий»
  art: Art;
};

export type Trailer = {
  id: string;
  kind: "trailer" | "teaser" | "clip" | "bts";
  note: string;
  length: string;
  release_label: string;
  art: Art;
  video_url: string | null; // MP4 streamed by the API; null = placeholder art only
  video_landscape: boolean; // horizontal video: the player turns wide on wide screens
  source_url: string | null; // where the trailer comes from (shown on the card)
  source_label: string; // «YouTube»
  title: TitleCard;
  in_watchlist: boolean;
};

// Title page: the card plus «О фильме» facts (from Kinopoisk where the title is listed; empty = hidden).
export type TitleDetail = TitleCard & {
  year: number;
  original_title: string;
  country: string;
  director: string;
  cast: string[];
  episode_length: string; // series only (the count is `episodes`)
  trailer_id: string | null;
};

export type Reel ={ slug: string; name: string; bg: string; count: number };

export type Home = { hero: Trailer | null; new: TitleCard[]; reels: Reel[] };

export type User = { id: string; handle: string; display_name: string; avatar_url: string | null };

// «Хочу посмотреть» (editable) and «Просмотренные» (static demo list for now, read-only in the API).
export type ListName = "watchlist" | "watched";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, { credentials: "same-origin", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error?.code ?? "http_error", body?.error?.message ?? res.statusText);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  // The filters narrow «Новое в библиотеке»; the hero stays the admin's pick.
  home: (f: { kind?: TitleCard["kind"]; maxMin?: number | null; genres?: string[] } = {}) => {
    const q = new URLSearchParams();
    if (f.kind) q.set("kind", f.kind);
    if (f.maxMin) q.set("max_min", String(f.maxMin));
    if (f.genres?.length) q.set("genre", f.genres.join(","));
    return request<Home>(`/home?${q}`);
  },
  feed: (f: { reel?: string; kind?: TitleCard["kind"]; maxMin?: number | null; genres?: string[] }) => {
    const q = new URLSearchParams();
    if (f.reel) q.set("collection", f.reel);
    if (f.kind) q.set("kind", f.kind);
    if (f.maxMin) q.set("max_min", String(f.maxMin));
    if (f.genres?.length) q.set("genre", f.genres.join(","));
    return request<{ items: Trailer[] }>(`/feed/trailers?${q}`);
  },
  title: (slug: string) =>
    request<{ title: TitleDetail; similar: TitleCard[]; in_watchlist: boolean }>(`/titles/${encodeURIComponent(slug)}`),
  genres: () => request<{ items: string[] }>("/genres"), // the fixed four: Триллер, Детектив, Драма, Ужасы
  me: () => request<User>("/me"),
  updateMe: (display_name: string, handle: string) => request<User>("/me", json("PATCH", { display_name, handle })),
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("avatar", file);
    return request<User>("/me/avatar", { method: "POST", body: fd });
  },
  list: (list: ListName) => request<{ items: TitleCard[] }>(`/me/lists/${list}`),
  setInList: (list: ListName, titleId: string, on: boolean) =>
    request<void>(`/me/lists/${list}/${titleId}`, { method: on ? "PUT" : "DELETE" }),
  demoLogin: () => request<User>("/auth/demo", { method: "POST" }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
};

export const trailerKindLabel: Record<Trailer["kind"], string> = {
  trailer: "Трейлер",
  teaser: "Тизер",
  clip: "Фрагмент",
  bts: "Со съёмок",
};

/** Russian plural: plural(3, ["история", "истории", "историй"]) → "истории". */
export function plural(n: number, [one, few, many]: [string, string, string]) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
