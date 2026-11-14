---
type: dev-log
project: KinoSite
tags: [log, status/planning]
updated: 2026-11-01
---
# Dev Log

> Chronological record of decisions and changes in KinoSite; newest entries at the top. Back to [[00_Hub_KinoSite]].

## Лог изменений
### 2026-11-13 — Real titles first
- «Трейлер недели» is «Ракка» (seed `hero_trailer`); the hero strip shows its real poster.
- Titles with a poster / trailers with a video come before the placeholders everywhere: «Новое в библиотеке», the feed (also inside a reel) and «Похожие» (then same genre, same kind). Schema version 13.

### 2026-11-12 — «Успеете N серий»
- «Сколько у вас времени» now hides only films that don't fit; micro-series always show, with how many episodes fit: a pill on the feed card («Успеете 3 серии из 6», «Успеете все 6 серий», «Не успеете ни одной серии») and a badge on «Кинотеатр» posters («3 из 6 серий»).
- `titles.episode_seconds` parsed from the episode length label («1:20» → 80 s, «8 мин» → 480 s), so 1:20 episodes count as 80 s, not 2 min. `episodes` and `episode_seconds` are on every title card; counting lives in `apps/web/lib/episodes.ts`. Schema version 12.

### 2026-11-12 — Four genres, one filter panel
- Only four genres: Триллер, Детектив, Драма, Ужасы (`store.Genres`; `GET /genres` always returns them, for films and series). Remapped: Ракка → Ужасы (Kinopoisk lists «ужасы»); placeholders Хроники Пустоши → Триллер, Стеклянный город → Детектив, Огни порта → Детектив, Лето на Оке → Драма, Двое в кадре → Драма (their conditional age ratings follow: Драма 12+, Триллер/Детектив 16+). Schema version 11.
- The header has one «Фильтры» button (instead of separate «Время» and genre buttons): the panel holds «Сколько у вас времени?» and «Жанры»; choices apply at once, «Сбросить всё» clears both, «Готово» closes. Switching films/series no longer resets genres (they are the same list).

### 2026-11-12 — Title pages
- New pages `/films/{slug}` and `/series/{slug}` (Kinopoisk-style): poster, age badge, original title and year, logline, «Смотреть трейлер» (opens the feed at it), «Хочу посмотреть», «Смотреть целиком / первую серию» (stub), «О фильме / О сериале» facts (год, страна, жанр, режиссёр, длительность или серий + длительность серии, возраст), «В главных ролях», «Похожие» (same genre first, then same kind).
- Facts from Kinopoisk: «Ракка» (film/1045792), «Кожа» (film/1072734; year set to 2018 as on Kinopoisk), «Дорога в пустоту» (series/14563371). «Коллектор» is not on Kinopoisk and the placeholders are fictional — their empty facts are hidden. New columns `original_title, country, director, cast_list, episodes, episode_length`; `GET /api/v1/titles/{slug}`. Schema version 10.
- Every poster (Кинотеатр, Профиль, «Похожие») opens the title page; the hero has «О фильме / О сериале»; in the feed the title text links to it.

### 2026-11-12 — Posters, age ratings, sources, disclaimer
- Real posters for «Ракка», «Кожа», «Коллектор», «Дорога в пустоту» (`apps/web/public/posters/`, `titles.poster`): shown on poster cards instead of the abstract art and used as the video `poster`, so a trailer that opens on black shows its poster first.
- Age ratings (`titles.age_rating`): Ракка 18+, Кожа 18+, Дорога в пустоту 18+ (official poster), Коллектор 16+ — decided by the team after checking Kinopoisk (Ракка: no rating there; Кожа: only MPAA R; Коллектор: not listed). Placeholder titles get conditional ratings by genre (drama/comedy/romance/sci-fi 12+, thriller/noir/detective 16+). Badge next to the title in the feed, on poster cards and in the hero line.
- Trailer sources (`trailers.source_url`, `source_label`): the feed card shows «Официальный трейлер · Источник: YouTube ↗» linking to the original.
- Disclaimer «Тестовая версия платформы…»: page footer on «Кинотеатр» and «Профиль»; on «Лента» a note at the left of the bottom band (desktop) or an ⓘ button that shows it (phones).
- Toasts grow upward from above the band (long ones used to slide under it) and stay longer for long text. Schema version 9.

### 2026-11-01 — Autoplay, moving sprockets, search
- Feed autoplays: on entering the feed, after each slide and after a filter change. If the browser blocks sound before the first tap, playback falls back to muted with a «Включить звук» button; after one tap later trailers play with sound. A trailer that plays to the end moves the feed to the next one.
- Seamless: playing is the default state, so ▶ never flashes on open or while sliding (it shows only after a manual pause or a fully blocked start); the incoming trailer starts as it slides in; neighbours preload (`preload="auto"`, three videos at most).
- The side perforation rides with the track (same timing as the frames, follows the finger on swipe); its offset wraps by the hole pitch so the reset after a slide is invisible.
- Search is back on «Кинотеатр»: a header button on desktop, a full-width bar under the header on phones (still a «скоро» stub).

### 2026-11-01 — Profile lists and filters on «Кинотеатр»
- Profile: «Недавно смотрели» → «Продолжить просмотр» (still static); list tabs are «Хочу посмотреть» (editable) and «Просмотренные» (static demo list from the seed, read-only in the API: `PUT/DELETE /me/lists/watched` → 404).
- «Нравится» removed from the feed together with the `liked` list and the `liked` field; the first-visit hint now covers «Хочу посмотреть» only. Schema version 8 (`list_items.list` is `watchlist | watched`).
- «Кинотеатр» header shows the same filters as «Лента» (Короткометражки / Микро-сериалы, «Время», genres) in place of the search stub. They narrow «Новое в библиотеке» (`GET /home` takes `kind`, `max_min`, `genre`); the hero stays the admin's pick, «Катушки» are unfiltered. Filters live in the URL of each page (`/?kind=series&time=5`).

### 2026-11-01 — Runtimes in the feed
- «Кожа» runtime is 21 min (was 20); «Ракка» stays 22 min.
- The feed card shows the title's runtime («22 мин», «6 серий по 1:20») instead of the trailer length, so it matches the «Время» filter. Series labels unified to «N серий по M мин». Schema version 7 (re-seed).

### 2026-11-01 — Wide player for horizontal videos
- Frames with a video sit on plain black; the abstract art is only for trailers without one.
- `trailers.video_landscape` (seed `"landscape": true` for the films; schema version 5). On a landscape screen a horizontal video fills the whole feed area between header and tab band, edge to edge (`object-cover`, no film strip, side arrows hidden; wheel/keys/swipe still switch). Vertical videos and placeholders keep the 9:16 card. A phone turned sideways gets the whole screen.

### 2026-11-01 — Film videos and landscape
- Films «Ракка» (2017, 22 мин, Фантастика; teaser = Oats Studios Volume 1 teaser) and «Кожа» (2019, 20 мин, Драма) with videos from `Media/Films/`; year, runtime and genre from TMDB, descriptions from the team. They lead the «Короткометражки» feed. Schema version 4 (re-seed).
- Videos use `object-contain`: a horizontal film trailer shows whole inside the vertical frame, the title's art fills the rest.
- Phone turned sideways (`landscape-phone` variant: landscape and height ≤ 500 px): the feed covers the whole screen, the video fills it; side arrows hidden, smaller title. Swipe and play work the same.

### 2026-11-01 — Smooth feed scrolling
- The feed renders previous / current / next frames on one vertical track that slides like film (420 ms, `--ease-film`); a swipe drags the track with the finger and snaps back under 60 px. A 600 ms fallback lands the slide if `transitionend` never arrives (hidden tab); reduced motion switches instantly.
- Neighbour frames keep their DOM when they become current, so a loaded video doesn't reload; a frame that slides away pauses and rewinds.
- Watch button: «Смотреть первую серию» for series, «Смотреть целиком» for films.

### 2026-11-01 — First real videos
- Two micro-series with real trailers from `Media/Serials/`: «Коллектор» (6 серий по 1:20) and «Дорога в пустоту» (20 серий по 2:30), both Триллер, descriptions from the team. They lead the «Микросериалы» feed.
- `trailers.video_file` (path under `KADR_MEDIA`, default `../../Media` from `apps/api`); `GET /api/v1/trailers/{id}/video` streams it with Range support; feed items carry `video_url`. Schema version 3.
- The feed card plays the MP4 in place of the placeholder art: tap/Space to play or pause, real progress line, length read from the file. Trailers without a file keep the abstract art.
- `Media/` is not in git (third-party clips, 24 MB); copy it next to `apps/` on another machine.

### 2026-11-01 — No counter in the feed
- Removed the «1 из N» chip from the feed card. In a reel the card still shows «← Все трейлеры».

### 2026-11-01 — Bottom band for the island
- The tab island now sits centered in a fixed bottom band as tall as the header (88 px desktop, 72 px phone; `--tabbar-h` in `globals.css`) instead of floating over content. The feed card fills the space between header and band.

### 2026-11-01 — Feed filters
- On «Лента» only, the header shows: «Короткометражки / Микросериалы» (title kind; phones: «Фильмы / Сериалы», and the time/filter buttons are icon-only there), «Время» (5 / 15 / 30 мин, «Любое» or a custom number of minutes) and «Фильтры» (genres, multi-select). Filters live in the URL (`?kind=series&time=15&genres=Драма`) and are applied by the API.
- API: `GET /feed/trailers` takes `kind`, `max_min`, `genre` (comma list); new `GET /genres?kind=`. «Время» compares with `titles.duration_min`: film length, or one episode for series.
- Seed: films are now 12–39 min and micro-series episodes 3–8 min (they were feature length). Schema version 2: an older `kadr.db` is dropped and re-seeded on start.

### 2026-11-01 — Feed actions
- Added «Комментарии» (stub, shows a notice) under «Нравится»; removed the «Звук» toggle. Actions now: Нравится · Комментарии · Хочу посмотреть · Поделиться.

### 2026-11-01 — Feed as one vertical card
- «Лента» on every screen size is a single centered 9:16 card in a film strip (no side columns, no prev/next peeks). Over the frame: kind · length · genre, title, note and an outlined «Смотреть целиком» (stub); icon-only actions on the right edge; a play button in the center (tap toggles, visual only); thin progress line. The tab island floats over the card's bottom.
- Desktop adds mouse-wheel switching and ↑/↓ arrows beside the card; phones swipe.
- First-visit hints next to «Нравится» and «Хочу посмотреть», closed by × or the first like/save (remembered in `localStorage`).

### 2026-11-01 — Tab island
- Section tabs moved out of the header into a floating pill «island» at the bottom of every page (phone and desktop): icon-only, the active tab in a lilac circle, names kept as `aria-label`/tooltip. `components/TabBar.tsx`.
- The header now holds only the logo and (on «Кинотеатр») search. The feed's height leaves room for the island.

### 2026-11-01 — Mobile layout
- Below 768 px: header tabs move to a fixed bottom tab bar; spacing and type tokens shrink in `globals.css` (components keep the same classes).
- «Лента» on phones is one full-screen 9:16 frame in a film strip; swipe up/down switches trailers, actions are round buttons over the frame.
- «Кинотеатр»: hero strip hidden, smaller posters, reels in 2 columns (spool holes in % so the reel scales). «Профиль»: smaller avatar and cards, 3-column lists.

### 2026-11-01 — Tab names
- Header tabs renamed: «Фильмы» → «Кинотеатр», «Трейлеры» → «Лента». Routes (`/`, `/trailers`) are unchanged.

### 2026-11-01 — Renamed to Micro.tv
- The product name shown on the site (header, page title) is now «Micro.tv» instead of «Кадр». Internal names (`kadr_session` cookie, `kadr.db`) are unchanged.

### 2026-11-01 — 1-day prototype scope
- New plan: [[10_Prototype_Plan]]. Only the 3 design screens, local only, one auto-signed-in demo user.
- No video yet (abstract placeholders); the design's fictional titles from a JSON seed, a real dataset later.
- SQLite instead of Postgres; Valkey, River, S3, CDN, OpenAPI codegen and observability are out for now.
- Content is free; «Катушки» are collections of titles; the hero trailer is picked by the admin.

### 2026-11-01 — Architecture v1
- Created the knowledge base: [[01_Tech_Stack]], [[02_Architecture]], [[03_Project_Structure]], [[04_Database_Schema]], [[05_API_Design]], [[06_Video_Pipeline]], [[07_Frontend_Design_Integration]], [[08_Roadmap]].
- Stack: Next.js + Tailwind v4 tokens / Go + chi + pgx + sqlc + River / PostgreSQL + Valkey / FFmpeg → HLS CMAF / S3 + CDN.
- Rejected Fiber (not `net/http`), GraphQL (kills HTTP caching), microservices (premature), separate DASH (CMAF keeps the option open).
- Design source: canvas «Кинотрейлеры — 6 направлений», direction «Г · Плёнка» (3 screens). Tokens extracted in [[07_Frontend_Design_Integration]].
- Open questions: production region & CDN provider; whether content is free or needs entitlements (affects `/playback` checks and DRM).
