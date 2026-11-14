---
type: cheat-sheet
project: KinoSite
tags: [go, nextjs, monorepo, structure]
updated: 2026-11-01
---
# Project Structure

> Folder layout for the monorepo, the Go backend (`apps/api`) and the Next.js frontend (`apps/web`), with the rules that keep module boundaries clean. Back to [[00_Hub_KinoSite]].

## Monorepo root
```text
KinoSite/
├── apps/
│   ├── api/                  # Go module (backend + worker)
│   └── web/                  # Next.js app
├── api/
│   └── openapi.yaml          # single source of truth for the HTTP contract
├── deploy/
│   ├── docker-compose.yml    # postgres, valkey, minio, mailpit (dev)
│   ├── Caddyfile             # / → web, /api → api
│   └── docker/               # Dockerfiles: api, worker, web
├── docs/                     # ← this Obsidian vault
├── .github/workflows/        # CI: lint, test, build
├── Makefile                  # dev shortcuts (see [[08_Roadmap]])
├── pnpm-workspace.yaml
└── README.md
```

## Go backend — apps/api
Layout follows "modules by domain" (see [[02_Architecture#Module map (Go)]]). Each module has the same 4 files so newcomers always know where to look.

```text
apps/api/
├── cmd/
│   ├── api/main.go           # HTTP server entrypoint
│   ├── worker/main.go        # River worker entrypoint (FFmpeg)
│   └── seed/main.go          # dev data from the design (Северный ветер, …)
├── internal/
│   ├── app/                  # composition root: wires config, db, modules, router
│   │   ├── app.go
│   │   └── router.go
│   ├── platform/             # infrastructure, no business logic
│   │   ├── config/           # env → typed Config
│   │   ├── db/               # pgxpool, tx helper
│   │   ├── cache/            # Valkey client, GetOrLoad, keys
│   │   ├── storage/          # S3 client, presign, multipart
│   │   ├── queue/            # River client + job args types
│   │   ├── httpx/            # JSON helpers, errors, pagination, middleware
│   │   └── auth/             # session middleware, CurrentUser(ctx)
│   ├── identity/             # users, sessions, settings
│   │   ├── handler.go        # HTTP: decode → service → encode
│   │   ├── service.go        # business rules, interfaces it needs
│   │   ├── repo.go           # wraps sqlc queries
│   │   └── model.go          # domain types + DTOs
│   ├── catalog/              # titles, series, seasons, episodes, collections, feed, search
│   ├── media/                # uploads, videos, renditions
│   │   └── transcode/        # FFmpeg ladder, packager, River worker
│   ├── playback/             # signed manifest URLs, token signer
│   ├── library/              # progress, lists, likes (+ progress flusher)
│   └── admin/                # CMS endpoints, publish/invalidate
├── db/
│   ├── migrations/           # goose: 00001_init.sql, …
│   ├── queries/              # sqlc: catalog.sql, library.sql, …
│   └── sqlc.yaml
├── gen/db/                   # sqlc output (generated, committed)
├── go.mod
└── .golangci.yml
```

**Rules**
1. `handler → service → repo`. Handlers never touch SQL; repos never know HTTP.
2. A module imports another module **only via its exported service interface** (e.g. `library` asks `catalog.Service` for title cards). No cross-module SQL joins in code — compose read models in SQL views if needed.
3. `internal/platform` must not import any domain module.
4. Generated code lives in `gen/` and is never edited by hand.

### Composition root (example)
```go
// internal/app/router.go
package app

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// NewRouter mounts every module under /api/v1. Modules expose Routes(chi.Router).
func (a *App) NewRouter() http.Handler {
	r := chi.NewRouter()

	// Global middleware: request id, real IP (behind Caddy), panic recovery, timeout.
	r.Use(middleware.RequestID, middleware.RealIP, a.logger.Middleware, middleware.Recoverer)
	r.Use(middleware.Timeout(15 * time.Second))
	r.Use(a.auth.LoadSession) // attaches user to ctx if cookie is valid; never rejects

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	r.Route("/api/v1", func(r chi.Router) {
		a.identity.Routes(r) // /auth/*, /me
		a.catalog.Routes(r)  // /titles, /series, /feed, /collections, /search, /home
		a.playback.Routes(r) // /videos/{id}/playback

		// Everything below requires a logged-in user.
		r.Group(func(r chi.Router) {
			r.Use(a.auth.RequireUser)
			a.library.Routes(r) // /me/progress, /me/lists, /me/history
		})

		// CMS: admin role only.
		r.Route("/admin", func(r chi.Router) {
			r.Use(a.auth.RequireRole("admin"))
			a.admin.Routes(r)
		})
	})
	return r
}
```

### A module handler (example)
```go
// internal/catalog/handler.go
package catalog

// getTitle handles GET /api/v1/titles/{slug}.
func (h *Handler) getTitle(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	t, err := h.svc.TitleBySlug(r.Context(), slug)
	if errors.Is(err, ErrNotFound) {
		httpx.Error(w, r, http.StatusNotFound, "title_not_found", "Title not found")
		return
	}
	if err != nil {
		httpx.Internal(w, r, err) // logs with request id, returns generic 500
		return
	}
	// Public catalog data: let the CDN/Next cache it briefly.
	w.Header().Set("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
	httpx.JSON(w, http.StatusOK, t)
}
```

## Next.js frontend — apps/web
```text
apps/web/
├── app/
│   ├── layout.tsx                    # <html lang="ru">, Jost font, header
│   ├── (catalog)/
│   │   ├── page.tsx                  # «Фильмы» home: hero, «Новое», «Катушки»
│   │   ├── films/[slug]/page.tsx     # film page (SSR/ISR + JSON-LD)
│   │   ├── series/[slug]/page.tsx    # series page with seasons
│   │   ├── series/[slug]/[season]/[episode]/page.tsx
│   │   ├── reels/[slug]/page.tsx     # collection («Катушка»)
│   │   └── search/page.tsx
│   ├── trailers/page.tsx             # vertical feed («Трейлеры»)
│   ├── watch/[videoId]/page.tsx      # full-screen player
│   ├── profile/page.tsx              # «Профиль»: history, lists, settings
│   ├── (auth)/login/page.tsx
│   └── api/revalidate/route.ts       # called by Go on publish
├── components/
│   ├── ui/                           # design-system primitives: Button, Tabs, Switch, IconButton
│   ├── film/                         # FilmStrip, Sprockets, PosterCard, Reel
│   ├── player/                       # VideoPlayer, Controls, ProgressBar, useHls
│   └── feed/                         # TrailerFeed, FeedItem, FeedActions
├── lib/
│   ├── api/                          # typed client generated from openapi.yaml
│   │   ├── schema.d.ts               # (generated)
│   │   └── client.ts                 # openapi-fetch instance, server/client variants
│   ├── hooks/
│   └── utils/
├── styles/
│   ├── tokens.css                    # @theme design tokens (see [[07_Frontend_Design_Integration]])
│   └── globals.css
├── public/icons/                     # SVG icons exported from the design
├── next.config.ts
└── package.json
```

**Rules**
- Server Components by default; `"use client"` only in `player/`, `feed/` and interactive `ui/` pieces.
- No hex values outside `tokens.css` — lint with `stylelint` / a grep in CI.
- All data access via `lib/api/client.ts` (typed); never hand-written `fetch` URLs.

## Лог изменений
- 2026-11-01 — initial layout.
