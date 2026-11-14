---
type: concept
project: KinoSite
tags: [nextjs, tailwind, design-tokens, hls, react]
updated: 2026-11-01
---
# Frontend & Design Integration («Г · Плёнка»)

> How the custom design «Плёнка» (screens: Фильмы, Трейлеры, Профиль) becomes Tailwind v4 tokens, film-strip components, an HLS player and the vertical feed in Next.js. Back to [[00_Hub_KinoSite]].

## What the design contains (inventory)
Source: the Design canvas «Кинотрейлеры — 6 направлений», direction **Г · Плёнка**.

| Screen | Route | Key pieces |
|---|---|---|
| Фильмы (Library) | `/` | Header (logo «Micro.tv» — «Кадр» in the design, 3 tabs, search), hero «Трейлер недели» + vertical strip, «Новое в библиотеке» horizontal film strip with sprockets, «Катушки» reels grid |
| Трейлеры | `/trailers` | 3 columns: title info · **vertical 9:16 player in a film strip** with prev/next peeks · actions (Нравится, Хочу посмотреть, Поделиться, Звук) + up/down + «1 из 5» |
| Профиль | `/profile` | avatar ring, «Недавно смотрели» strip (9:16 cards + date), «Списки» tabs (Хочу посмотреть / Понравилось), «Настройки» switches, «Выйти» |

Recurring motifs → components: **Sprockets** (perforation rows), **FilmStrip** (horizontal / vertical), **PosterCard** (2:3), **CoverCard** (9:16), **Reel** (rotating ring on hover), **Tabs**, **Switch** (square knob).

## Design tokens → styles/tokens.css
Extracted 1:1 from the design's values. Tailwind v4 generates utilities (`bg-surface`, `text-muted`, `rounded-btn`, …) from `@theme`.

```css
/* apps/web/styles/tokens.css — the only place where raw design values live */
@import "tailwindcss";

@theme {
  /* Color — dark film palette */
  --color-ground: #0D0A11;        /* page background, sprocket holes */
  --color-surface: #1E1726;       /* film strip, secondary buttons */
  --color-surface-hover: #2A2133; /* hover + dividers */
  --color-line: #2A2133;
  --color-ink: #F1EAF8;           /* primary text */
  --color-ink-soft: #E3D9EE;      /* body copy, loglines */
  --color-muted: #A699B5;         /* secondary text, inactive tabs */
  --color-accent: #C9A7FF;        /* lilac: CTA, active tab, progress */
  --color-accent-hover: #E8DAFF;
  --color-on-accent: #170F20;     /* text on lilac */
  --color-danger: #FF9FC8;        /* «Выйти из аккаунта» */

  /* Typography — Jost 400–800 */
  --font-sans: "Jost", system-ui, sans-serif;
  --text-body: 17px;
  --text-hero: 96px;   --text-hero--line-height: 0.92; --text-hero--letter-spacing: -0.03em;
  --text-h1: 64px;     --text-h1--line-height: 1;      --text-h1--letter-spacing: -0.03em;
  --text-feed: 60px;   --text-feed--line-height: 0.95;
  --text-h2: 44px;     --text-h2--letter-spacing: -0.02em;
  --text-h3: 36px;

  /* Radius */
  --radius-frame: 4px;   /* film frames, posters */
  --radius-strip: 8px;
  --radius-btn: 10px;
  --radius-switch: 6px;

  /* Spacing / layout */
  --spacing-gutter: 64px;   /* page side padding at desktop */
  --spacing-section: 112px; /* vertical rhythm between sections */
  --container-page: 1440px;

  /* Motion */
  --ease-film: cubic-bezier(.2, .8, .2, 1);
}

/* Base layer: page defaults + focus ring from the design */
@layer base {
  body { @apply bg-ground text-ink font-sans; font-size: var(--text-body); line-height: 1.5; }
  ::selection { background: var(--color-accent); color: var(--color-ground); }
  :focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
}
```

**Workflow for future design changes**: keep a `design-tokens.json` (W3C DTCG format) next to the design; a small script (or Style Dictionary) regenerates `tokens.css`. Components never change — only tokens.

**Mobile**: the design is desktop (1440). Use `--spacing-gutter: 16px` under `md`, stack the Trailers screen to a full-screen vertical feed (TikTok-style), header tabs → bottom tab bar.

## Component examples
### Sprockets + FilmStrip
```tsx
// components/film/FilmStrip.tsx — horizontal strip with perforations (design: «Новое в библиотеке»)
import type { ReactNode } from "react";

/** Decorative perforation row. Hidden from assistive tech. */
function Sprockets({ count = 56 }: { count?: number }) {
  return (
    <div aria-hidden className="flex gap-4 overflow-hidden px-2">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-[13px] w-[18px] flex-none rounded-[3px] bg-ground" />
      ))}
    </div>
  );
}

export function FilmStrip({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface py-3">
      <Sprockets />
      {/* Scroll-snap row; scrollbar hidden as in the design */}
      <div className="flex snap-x gap-3 overflow-x-auto px-gutter py-3 [scrollbar-width:none]">
        {children}
      </div>
      <Sprockets />
    </div>
  );
}
```

### PosterCard (2:3) with fallback art
```tsx
// components/film/PosterCard.tsx
import Image from "next/image";
import Link from "next/link";
import { imageUrl } from "@/lib/utils/image";

type Props = { slug: string; kind: "film" | "series"; title: string; posterKey?: string; accent?: string };

export function PosterCard({ slug, kind, title, posterKey, accent = "#1E1726" }: Props) {
  const href = kind === "film" ? `/films/${slug}` : `/series/${slug}`;
  return (
    <Link href={href}
      className="group w-[200px] flex-none snap-start text-ink no-underline">
      <div className="relative aspect-[2/3] overflow-hidden rounded-frame transition-transform duration-300 ease-film group-hover:scale-[1.04]"
           style={{ background: accent }}>
        {posterKey && (
          <Image src={imageUrl(posterKey, 400)} alt="" fill sizes="200px" className="object-cover" />
        )}
        {/* Title on the frame, as in the design */}
        <span className="absolute inset-x-3.5 bottom-3.5 text-xl font-extrabold leading-none">{title}</span>
      </div>
    </Link>
  );
}
```

### Switch (Profile → Настройки) on Radix, styled with tokens
```tsx
// components/ui/Switch.tsx — square-knob switch from the design
"use client";
import * as RSwitch from "@radix-ui/react-switch";

export function Switch(props: RSwitch.SwitchProps) {
  return (
    <RSwitch.Root {...props}
      className="relative h-[30px] w-[54px] flex-none rounded-switch bg-surface-hover data-[state=checked]:bg-accent">
      <RSwitch.Thumb
        className="block size-[22px] translate-x-1 rounded bg-muted transition-transform
                   data-[state=checked]:translate-x-7 data-[state=checked]:bg-on-accent" />
    </RSwitch.Root>
  );
}
```

## Player
```tsx
// components/player/useHls.ts — attach HLS: native on Safari, hls.js elsewhere
"use client";
import { useEffect, type RefObject } from "react";
import type Hls from "hls.js";

export function useHls(ref: RefObject<HTMLVideoElement | null>, src: string | null, opts?: { lowStart?: boolean }) {
  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;

    // Safari / iOS: native HLS is more efficient (and required on iPhone).
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return () => { video.removeAttribute("src"); video.load(); };
    }

    let hls: Hls | undefined;
    let cancelled = false;
    // Lazy-load hls.js (~100 KB) only when a player is mounted.
    import("hls.js").then(({ default: HlsCtor }) => {
      if (cancelled || !HlsCtor.isSupported()) return;
      hls = new HlsCtor({
        startLevel: opts?.lowStart ? 0 : -1, // feed: start at lowest rung for instant playback
        capLevelToPlayerSize: true,          // don't fetch 1080p for a 520px player
        maxBufferLength: 20,
      });
      hls.on(HlsCtor.Events.ERROR, (_e, data) => {
        // 403 on a segment → token expired → caller re-requests /playback.
        if (data.response?.code === 403) video.dispatchEvent(new CustomEvent("tokenexpired"));
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    });
    return () => { cancelled = true; hls?.destroy(); };
  }, [ref, src, opts?.lowStart]);
}
```

```tsx
// components/player/useProgressReporter.ts — PUT /me/progress every 10 s + on pause/unload
"use client";
import { useEffect, type RefObject } from "react";

export function useProgressReporter(ref: RefObject<HTMLVideoElement | null>, videoId: string) {
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const send = () => {
      if (!v.duration || Number.isNaN(v.duration)) return;
      const body = JSON.stringify({ position_ms: Math.round(v.currentTime * 1000), duration_ms: Math.round(v.duration * 1000) });
      // keepalive lets the request finish while the tab is closing.
      fetch(`/api/v1/me/progress/${videoId}`, { method: "PUT", body, keepalive: true,
        headers: { "Content-Type": "application/json" } }).catch(() => {});
    };
    const timer = setInterval(() => { if (!v.paused) send(); }, 10_000);
    v.addEventListener("pause", send);
    window.addEventListener("pagehide", send);
    return () => { clearInterval(timer); v.removeEventListener("pause", send); window.removeEventListener("pagehide", send); };
  }, [ref, videoId]);
}
```

### Vertical trailer feed
- Desktop (design): 520 px strip, one active item, prev/next peeks, ↑/↓ buttons, keyboard ↑/↓.
- Mobile: full-height `scroll-snap-type: y mandatory` list; `IntersectionObserver` (threshold 0.6) marks the active item.
- Only **3 `<video>` elements** exist at once (prev, current, next); others render the poster.
- Data: `useInfiniteQuery` (TanStack Query) over `GET /feed/trailers?cursor=`; playback URLs requested lazily for current ±1.

## SEO checklist
- `generateMetadata` per title: title, description = logline, OG image = poster (1200×630 crop).
- JSON-LD: `Movie` for films, `TVSeries` + `TVEpisode` for series, `VideoObject` for trailers (`thumbnailUrl`, `uploadDate`, `duration`, `contentUrl` = public trailer page, not the signed HLS).
- `app/sitemap.ts` generated from `/titles` (published only); `robots.ts` disallows `/profile`, `/watch`.
- ISR: `fetch(url, { next: { tags: ["title:" + id], revalidate: 3600 } })`; Go calls `POST /api/revalidate` with a shared secret on publish.

```tsx
// app/(catalog)/films/[slug]/page.tsx — server component with metadata + JSON-LD
import { notFound } from "next/navigation";
import { api } from "@/lib/api/client";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await api.titleBySlug(slug);
  return t ? { title: `${t.title} — Micro.tv`, description: t.logline,
               openGraph: { images: [t.og_image_url] } } : {};
}

export default async function FilmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await api.titleBySlug(slug); // cached, tagged title:<id>
  if (!t || t.kind !== "film") notFound();

  const jsonLd = { "@context": "https://schema.org", "@type": "Movie", name: t.title,
    description: t.logline, image: t.poster_url, dateCreated: String(t.year),
    genre: t.genres.map((g) => g.name) };

  return (
    <main className="mx-auto max-w-page px-gutter">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="text-hero font-extrabold">{t.title}</h1>
      {/* PlayButton is a client island: it calls /playback and opens the player */}
    </main>
  );
}
```

## Лог изменений
- 2026-11-01 — tokens extracted from «Плёнка» (D-Library, D-Trailers, D-Profile).
