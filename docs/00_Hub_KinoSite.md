---
type: project-hub
project: KinoSite
tags: [go, nextjs, postgresql, hls, status/planning]
updated: 2026-11-01
---
# KinoSite («Micro.tv») — Project Hub

> Entry point (MOC) for the KinoSite prototype: a streaming platform for short films and episodic web series, with a vertical (9:16) trailer feed.

## Product in one paragraph
Users browse a catalog of **short films** and **web series** (series → seasons → episodes), watch them through adaptive streaming, swipe through a **vertical trailer feed**, keep a watch history with resume, and maintain two lists — «Хочу посмотреть» (watchlist) and «Понравилось» (liked). Curated **«Катушки»** (reels / collections) group titles. The UI comes from the custom design «Г · Плёнка» (see [[07_Frontend_Design_Integration]]).

## Decisions at a glance
| Area | Choice | Note |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS v4 tokens | [[01_Tech_Stack]] |
| Backend | Go, `chi` router, `pgx` + `sqlc`, `River` job queue | [[01_Tech_Stack]] |
| Data | PostgreSQL + Valkey/Redis | [[04_Database_Schema]] |
| Video | FFmpeg → HLS (CMAF/fMP4), S3-compatible storage, CDN with path tokens | [[06_Video_Pipeline]] |
| Shape | Monorepo, modular monolith (one Go codebase, `api` + `worker` binaries) | [[02_Architecture]] |

## Компоненты (Architecture)
- [[01_Tech_Stack]] — why each technology was chosen (and what was rejected)
- [[02_Architecture]] — system design, monorepo, modular monolith, request flows
- [[03_Project_Structure]] — folder layout for `apps/api` (Go) and `apps/web` (Next.js)
- [[04_Database_Schema]] — tables, relations, indexes, DDL
- [[05_API_Design]] — REST endpoints for the MVP, auth, pagination, errors
- [[06_Video_Pipeline]] — upload → transcode → package → secure delivery
- [[07_Frontend_Design_Integration]] — design tokens from the «Плёнка» design, player, feed

## Инструкции (How-to)
- [[10_Prototype_Plan]] — **current**: the 1-day prototype (3 screens, Go + SQLite, no video)
- [[11_Setup]] — install and run in detail (the root README is the short Windows version)
- [[08_Roadmap]] — step-by-step implementation guide for the full product (after the prototype)

## Логи
- [[09_Dev_Log]] — decisions and changes over time

## Важные нюансы (read before coding)
- The design is **vertical-first**: trailers are 9:16, posters 2:3. The encoding ladder in [[06_Video_Pipeline]] is built for portrait video; landscape films get a separate ladder.
- Segments are served with **path-based tokens** (`/t/{exp}/{sig}/v/...`) so relative URLs inside HLS playlists inherit authorization — query-string tokens would be lost on every segment request.
- The browser never talks to Go directly from another origin: Next.js and the API share one domain (`/api/*` reverse-proxied), so session cookies stay `HttpOnly; SameSite=Lax` with no CORS.
- Watch progress is written every ~10 s by every viewer → buffered in Redis and flushed to Postgres in batches (see [[04_Database_Schema#watch_progress]]).
- No pre-built component libraries (MUI etc.). Only **unstyled** primitives (Radix) for accessibility of tabs, switches and dialogs.

## Todo
- [ ] Phase 0–1 of [[08_Roadmap]]: repo, docker-compose, migrations
- [ ] Confirm production region/CDN (RU audience → Selectel / Yandex Cloud; global → Cloudflare R2 + CDN)
- [ ] Export final SVG icons and logo from the design canvas into `apps/web/public/`
