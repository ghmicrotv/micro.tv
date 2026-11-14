---
type: cheat-sheet
project: KinoSite
tags: [roadmap, setup, docker, status/planning]
updated: 2026-11-01
---
# Implementation Roadmap

> Practical step-by-step guide from an empty `KinoSite/` folder to a working prototype (catalog, vertical trailer feed, HLS playback, profile). Back to [[00_Hub_KinoSite]].

> [!important] For the first demo, use [[10_Prototype_Plan]] (1 day, 3 screens, SQLite, no video). This roadmap is the plan for the phases after it.

**Estimate for one full-stack developer:** ~6–8 weeks to a demo-able prototype.

## Phase 0 — Repository & local infrastructure (day 1–2)
```bash
# Monorepo skeleton (run from KinoSite/)
git init
mkdir -p apps/api apps/web api deploy docs
cd apps/api && go mod init github.com/<you>/kinosite/api && cd ../..

# Frontend: Next.js + TS + Tailwind, App Router, src-less layout
pnpm create next-app@latest apps/web --ts --tailwind --app --eslint --use-pnpm --no-src-dir
printf "packages:\n  - 'apps/web'\n" > pnpm-workspace.yaml
```

`deploy/docker-compose.yml` — everything except our own apps:
```yaml
# Dev infrastructure: Postgres, Valkey, MinIO (S3), Mailpit (emails).
services:
  postgres:
    image: postgres:17-alpine
    environment: { POSTGRES_USER: kadr, POSTGRES_PASSWORD: kadr, POSTGRES_DB: kadr }
    ports: ["5432:5432"]
    volumes: [pg:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U kadr"], interval: 5s }
  valkey:
    image: valkey/valkey:8-alpine
    ports: ["6379:6379"]
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment: { MINIO_ROOT_USER: kadr, MINIO_ROOT_PASSWORD: kadrkadr123 }
    ports: ["9000:9000", "9001:9001"]
    volumes: [s3:/data]
  createbuckets:                     # one-shot: create media-src, media-hls, img
    image: minio/mc:latest
    depends_on: [minio]
    entrypoint: >
      sh -c "mc alias set local http://minio:9000 kadr kadrkadr123 &&
             mc mb -p local/media-src local/media-hls local/img"
  mailpit:
    image: axllent/mailpit:latest
    ports: ["8025:8025", "1025:1025"]
volumes: { pg: {}, s3: {} }
```
> Pin exact image tags before sharing the repo; `latest` is only for the first spin-up.

`Makefile`:
```make
# Dev shortcuts. Requires: go, pnpm, docker, goose, sqlc, ffmpeg.
DB_URL ?= postgres://kadr:kadr@localhost:5432/kadr?sslmode=disable

up:        ; docker compose -f deploy/docker-compose.yml up -d
down:      ; docker compose -f deploy/docker-compose.yml down
migrate:   ; goose -dir apps/api/db/migrations postgres "$(DB_URL)" up
sqlc:      ; cd apps/api && sqlc generate
api:       ; cd apps/api && go run ./cmd/api
worker:    ; cd apps/api && go run ./cmd/worker
seed:      ; cd apps/api && go run ./cmd/seed
web:       ; pnpm --filter web dev
types:     ; pnpm --filter web exec openapi-typescript ../../api/openapi.yaml -o lib/api/schema.d.ts
test:      ; cd apps/api && go test ./... && pnpm --filter web test
```

**Done when:** `make up` works, MinIO console opens on :9001, Next dev page on :3000.

## Phase 1 — Backend foundation (days 3–6)
1. `go get` core deps:
   ```bash
   go get github.com/go-chi/chi/v5 github.com/jackc/pgx/v5 github.com/redis/go-redis/v9 \
          github.com/riverqueue/river github.com/riverqueue/river/riverdriver/riverpgxv5 \
          github.com/aws/aws-sdk-go-v2/service/s3 github.com/google/uuid \
          golang.org/x/crypto/argon2 golang.org/x/sync/singleflight github.com/caarlos0/env/v11
   ```
2. `internal/platform/config` (env struct), `db` (pgxpool), `cache`, `httpx` (JSON, errors, cursor helpers).
3. Migration `00001_init.sql` from [[04_Database_Schema]] → `make migrate`; River's own migration: `river migrate-up --database-url "$DB_URL"`.
4. `sqlc.yaml` + first queries → `make sqlc`.
5. `cmd/api/main.go` with graceful shutdown:
   ```go
   // cmd/api/main.go — start HTTP server, stop cleanly on SIGINT/SIGTERM.
   func main() {
   	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
   	defer stop()

   	a, err := app.New(ctx) // loads config, connects Postgres/Valkey/S3, builds modules
   	if err != nil {
   		slog.Error("init failed", "err", err)
   		os.Exit(1)
   	}
   	srv := &http.Server{Addr: a.Cfg.HTTPAddr, Handler: a.NewRouter(),
   		ReadHeaderTimeout: 5 * time.Second}

   	go func() {
   		slog.Info("api listening", "addr", srv.Addr)
   		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
   			slog.Error("server error", "err", err)
   			stop()
   		}
   	}()
   	go a.Library.RunProgressFlusher(ctx, 15*time.Second) // Redis → Postgres batches

   	<-ctx.Done() // wait for signal
   	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
   	defer cancel()
   	_ = srv.Shutdown(shutdownCtx) // finish in-flight requests
   	a.Close()
   }
   ```
6. `identity` module: register / login / logout / `me`, argon2id, sessions + middleware ([[05_API_Design#Go: session middleware sketch]]).
7. Tests: `httptest` for handlers, **testcontainers-go** Postgres for repos.

**Done when:** `curl -X POST /api/v1/auth/register` sets a cookie and `/me` returns the user.

## Phase 2 — Catalog & seed data (days 7–10)
1. `catalog` repo + service: titles, seasons, episodes, trailers, collections, genres, search.
2. Endpoints `/home`, `/titles`, `/titles/{slug}`, `/feed/trailers`, `/collections/*`, `/search`.
3. Cache-aside on `/home`, `/titles/{slug}`, feed pages ([[01_Tech_Stack#Caching strategy (4 layers)]]).
4. `cmd/seed`: insert the design's content (Северный ветер, Последний сеанс, Хроники Пустоши, Огни порта, Стеклянный город…; reels «Нуар и ночь», «Северные истории», …) with `accent_color` from the design so the UI looks right before real posters exist.
5. Write `api/openapi.yaml` for these endpoints → `make types`.

**Done when:** `/home` JSON contains hero, new rail and 5 reels.

## Phase 3 — Video pipeline (days 11–17)
1. `platform/storage`: S3 client (MinIO endpoint, path-style), presign, multipart, `UploadDir` with `Cache-Control: immutable`.
2. `media` module: `/admin/uploads`, `/complete` (enqueue River job **in the same tx**).
3. `cmd/worker`: River client on queue `media`, `transcode.Worker` ([[06_Video_Pipeline#Worker: FFmpeg invocation (Go)]]); install `ffmpeg` in the worker Docker image.
4. Thumbnails sprite + VTT, poster frame.
5. `playback` module: `POST /videos/{id}/playback` + `Signer`.
6. **Dev edge**: tiny Go handler `/t/{exp}/{sig}/*` → `Verify` → reverse-proxy to MinIO `media-hls` (mirrors the prod CDN worker).
7. Test with a real vertical clip: `ffplay`/Safari opens the signed `master.m3u8`; switch rungs in hls.js debug.

**Done when:** an uploaded MP4 becomes `ready` and plays via the signed URL in Chrome and Safari.

## Phase 4 — Frontend shell & design system (days 18–24)
1. `styles/tokens.css` from [[07_Frontend_Design_Integration#Design tokens → styles/tokens.css]]; load Jost via `next/font/google` (weights 400–800, `subsets: ["cyrillic","latin"]`).
2. Export the design's SVG icons & logo into `public/icons/`.
3. Primitives: `Button`, `IconButton`, `Tabs`, `Switch` (Radix), `Sprockets`, `FilmStrip`, `PosterCard`, `CoverCard`, `Reel`.
4. Layout: header with 3 tabs (active = `aria-current`), search button; mobile bottom bar.
5. `lib/api/client.ts` with `openapi-fetch`: server variant forwards the cookie, client variant uses relative `/api`.
6. Next `rewrites` in dev: `/api/:path*` → `http://localhost:8080/api/:path*` (same origin, no CORS).

**Done when:** «Фильмы» page renders from `/home` and matches the design side by side.

## Phase 5 — Player, feed, title pages (days 25–33)
1. `useHls`, `VideoPlayer` with custom controls (pause, lilac progress, time, sound), keyboard shortcuts (Space, ←/→, M).
2. `/watch/[videoId]`: resume from `resume_at_ms`; `useProgressReporter`; autoplay next episode (respect `autoplay` setting).
3. `/trailers`: vertical feed — 3 live `<video>` elements, prefetch next, ↑/↓, likes, «Хочу посмотреть».
4. Film & series pages with seasons/episodes, JSON-LD, `generateMetadata`, sitemap.
5. `/api/revalidate` route + Go publish hook.

**Done when:** you can swipe trailers, open a film, watch, close the tab, come back and resume.

## Phase 6 — Profile & library (days 34–38)
1. `library` module: lists, history, continue-watching, trailer likes, progress buffer + flusher.
2. `/profile`: «Недавно смотрели» strip, «Списки» tabs, «Настройки» switches bound to `/me/settings`, logout.
3. Optimistic UI for list/like toggles (TanStack Query `onMutate`).

**Done when:** the Profile screen shows real history and lists.

## Phase 7 — Hardening & deploy (days 39–45)
- Rate limits, `Origin` check, CSP (`media-src` = CDN domain), secure cookies.
- Observability: `slog` JSON, OpenTelemetry, `/metrics`; player QoE events.
- CI: `golangci-lint`, `go test -race`, `pnpm lint && pnpm build`, `sqlc diff` (fails if generated code is stale).
- Deploy: VM + Docker Compose + Caddy (auto-TLS), managed object storage + CDN with token validation, daily `pg_dump` to object storage.
- Load test feed + playback endpoints with `k6` (target: p95 < 100 ms for cached catalog endpoints).

## After the prototype
- Admin UI (Next route group `/studio`) instead of curl/scripts.
- Recommendations (co-watch in Postgres → later a separate service).
- HEVC/AV1 rungs, per-title encoding, AES-128 or DRM for premium.
- Subtitles (WebVTT tracks in the master playlist), multiple audio tracks.
- Native apps reuse the same API + HLS.

## Лог изменений
- 2026-11-01 — roadmap v1.
