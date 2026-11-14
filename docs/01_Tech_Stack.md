---
type: concept
project: KinoSite
tags: [go, nextjs, postgresql, redis, tailwind, status/decided]
updated: 2026-11-01
---
# Tech Stack Justification

> Why each technology was chosen for a short-film / web-series streaming prototype, and which alternatives were rejected. Back to [[00_Hub_KinoSite]].

## Summary

| Layer | Choice | Runner-up | Why not the runner-up |
|---|---|---|---|
| Web framework | **Next.js (App Router, RSC)** | SvelteKit | Smaller ecosystem for video/players, fewer hires |
| Styling | **Tailwind CSS v4 + CSS variables** | CSS Modules | Tokens + utilities map 1:1 to the design's inline styles |
| UI primitives | **Radix UI (unstyled)** | Headless UI | Radix covers Tabs, Switch, Dialog, Slider — all in the design |
| Player | **hls.js + own React controls** | Vidstack / Video.js | Pre-styled skins fight a custom design |
| Go router | **chi** | Echo | Both fine; chi is pure `net/http` |
| DB access | **pgx v5 + sqlc** | GORM | sqlc = typed SQL, no ORM magic, fast |
| Database | **PostgreSQL** | MySQL | JSONB, FTS, `pg_trgm`, partial indexes, River queue |
| Cache / ephemeral | **Valkey (Redis-compatible)** | Memcached | Data structures for buffering, rate limits, sessions |
| Jobs | **River** (Postgres-backed queue) | NATS / RabbitMQ | No extra infra for MVP; transactional enqueue |
| Object storage | **S3-compatible** (MinIO dev) | — | Any provider, one SDK |
| Migrations | **goose** | golang-migrate | SQL files + Go migrations, simple CLI |

---

## Frontend: Next.js
**Why it fits this product**
1. **SEO is a feature here.** Title pages (`/films/severnyi-veter`, `/series/.../s1/e3`) must be indexable with rich previews. Server Components render HTML on the server; `generateMetadata` gives Open Graph per title; JSON-LD `Movie` / `TVSeries` / `VideoObject` gets Google video rich results.
2. **ISR/caching of catalog pages.** Catalog data changes rarely → statically cached pages, revalidated on publish via `revalidateTag('title:<id>')` called by the Go API after an admin edit.
3. **Client islands for video.** The player and the vertical feed are `"use client"` components; everything around them (metadata, lists, rails) stays server-rendered → small JS bundles.
4. **Ecosystem.** hls.js, Radix, Framer Motion, `next/image` for posters — mature and well documented.

**Rejected**
- *Nuxt/Vue* — equally capable; chosen against only for ecosystem size and TS ergonomics around React players.
- *SvelteKit* — the best raw performance, but fewer battle-tested video integrations; a good choice if the team already knows Svelte.
- *SPA (Vite + React)* — loses SSR/SEO, which is core for a content catalog.

## Styling: Tailwind CSS v4 + design tokens
The design is written as plain CSS values (`#0D0A11`, `gap: 36px`, `font-size: 96px`). Tailwind v4's `@theme` turns those into **CSS variables + utilities** in one place, so:
- tokens live in one file (`tokens.css`) and can be generated from a design-token JSON later;
- every component uses `bg-surface text-ink`, never raw hex;
- custom motifs (film-strip holes, reels) are plain components, no library overrides.
Details: [[07_Frontend_Design_Integration]].

## Video player: hls.js + custom controls
- Safari/iOS play HLS natively → use `<video src>` there; everywhere else attach **hls.js** (MSE).
- Our controls (pause button, progress bar in `#C9A7FF`, sound toggle) are our own React components — exactly the design's player.
- Vidstack is a reasonable alternative if you need captions/AirPlay/Chromecast quickly; use it **headless** only.

## Backend: Go + chi
- Go: low memory per connection, simple deploys (one static binary), great for API + FFmpeg orchestration.
- **chi** is a thin router on top of `net/http`: every stdlib middleware, `httptest`, OpenTelemetry and `http.Handler` works unchanged.
- **Echo** / **Gin** are acceptable (more built-ins: binding, validation). Pick one and keep handlers framework-agnostic.
- **Fiber is rejected**: it is built on `fasthttp`, not `net/http` — no HTTP/2, incompatible middleware ecosystem, and request objects are reused (dangerous when passing them to goroutines). Its speed advantage is irrelevant: the bottleneck is the DB and the CDN, not routing.

## Data: PostgreSQL + sqlc
- Relational domain: series → seasons → episodes, users ↔ lists, history.
- Built-in **full-text search** (`tsvector` with `russian` config) + `pg_trgm` for typo tolerance → no Elasticsearch for MVP.
- **sqlc** generates typed Go from SQL files: compile-time safety, zero reflection.
- Schema: [[04_Database_Schema]].

## Caching strategy (4 layers)
| Layer | What | TTL / invalidation |
|---|---|---|
| CDN | HLS segments, posters | Segments `immutable`, 1 year (content-addressed paths) |
| CDN / Next cache | Catalog HTML (ISR) | `revalidateTag` on publish |
| Valkey | API responses: home, title detail, feed pages | 60–300 s + explicit delete on publish |
| Valkey | Sessions, rate limits, progress buffer | Session TTL 30 d; progress flushed every 15 s |

Rule: **cache-aside** in the Go service layer, keys versioned (`v1:title:{id}`), with `singleflight` to stop cache stampedes.

```go
// internal/platform/cache/cache.go
// GetOrLoad: cache-aside with singleflight to avoid stampedes on hot keys.
func GetOrLoad[T any](ctx context.Context, c *Cache, key string, ttl time.Duration,
	load func(context.Context) (T, error)) (T, error) {
	var zero T
	// 1. Try Redis first.
	if raw, err := c.rdb.Get(ctx, key).Bytes(); err == nil {
		var v T
		if err := json.Unmarshal(raw, &v); err == nil {
			return v, nil
		}
	}
	// 2. Collapse concurrent misses for the same key into one DB call.
	res, err, _ := c.sf.Do(key, func() (any, error) {
		v, err := load(ctx)
		if err != nil {
			return zero, err
		}
		if raw, err := json.Marshal(v); err == nil {
			// Errors on SET are non-fatal: we still return fresh data.
			_ = c.rdb.Set(ctx, key, raw, ttl).Err()
		}
		return v, nil
	})
	if err != nil {
		return zero, err
	}
	return res.(T), nil
}
```

## Video
Encoding, storage, CDN and signed delivery: [[06_Video_Pipeline]].

## Лог изменений
- 2026-11-01 — initial stack decisions.
