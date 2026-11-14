---
type: cheat-sheet
project: KinoSite
tags: [rest, openapi, go, auth]
updated: 2026-11-01
---
# API Design (REST, MVP)

> The REST endpoints the MVP needs, with auth, pagination and error conventions; the contract lives in `api/openapi.yaml`. Back to [[00_Hub_KinoSite]].

## Why REST (not GraphQL)
- Screens map cleanly to a few aggregate endpoints (`/home`, `/titles/{slug}`, `/feed/trailers`) — no over-fetching problem worth GraphQL's complexity.
- REST GETs are **HTTP-cacheable** at the CDN and in Next's fetch cache; GraphQL POSTs are not.
- OpenAPI → generated TS client gives the same type safety (see [[03_Project_Structure#Next.js frontend — apps/web]]).

## Conventions
| Topic | Rule |
|---|---|
| Base | `/api/v1`, JSON, `snake_case` fields |
| Auth | Opaque session token in cookie `kadr_session` (`HttpOnly; Secure; SameSite=Lax; Path=/`). Stored as `sha256` in `sessions` ([[04_Database_Schema]]), cached in Valkey |
| CSRF | `SameSite=Lax` + middleware rejecting mutating requests whose `Origin` ≠ site origin |
| Pagination | Cursor-based: `?limit=20&cursor=<opaque>` → `{ "items": [...], "next_cursor": "..." \| null }` (cursor = base64 of last sort key) — stable while the feed grows |
| Errors | `{ "error": { "code": "title_not_found", "message": "...", "request_id": "..." } }` |
| Images | API returns **keys**, client builds URLs via image CDN: `https://img.cdn/{key}?w=400&fmt=avif` |
| Rate limits | Valkey token bucket: auth 10/min/IP, progress 12/min/user, others 300/min/IP |

## Endpoints

### Identity
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | `{email, password, display_name}` → sets cookie, 201 |
| POST | `/auth/login` | `{email, password}` → sets cookie |
| POST | `/auth/logout` | deletes session |
| GET | `/me` | current user or 401 |
| PATCH | `/me` | display name, handle |
| GET / PATCH | `/me/settings` | `autoplay`, `sound_on_start`, `premiere_notify` (design's toggles) |

### Catalog (public, cacheable)
| Method | Path | Description |
|---|---|---|
| GET | `/home` | aggregate for «Фильмы»: `hero` (трейлер недели), `new` rail, `reels` |
| GET | `/titles?kind=film\|series&genre=drama&sort=new\|popular&cursor=` | catalog grid («Весь каталог») |
| GET | `/titles/{slug}` | film or series detail; series include seasons summary |
| GET | `/titles/{slug}/seasons/{number}` | season with episodes |
| GET | `/episodes/{id}` | episode detail + `prev`/`next` ids for autoplay |
| GET | `/titles/{slug}/trailers` | trailers of one title |
| GET | `/feed/trailers?cursor=` | vertical feed («Трейлеры»), 10 per page |
| GET | `/collections` | all «Катушки» |
| GET | `/collections/{slug}?cursor=` | reel with ordered titles |
| GET | `/genres` | genre list |
| GET | `/search?q=&cursor=` | FTS + trigram |

### Playback
| Method | Path | Description |
|---|---|---|
| POST | `/videos/{id}/playback` | returns signed `manifest_url`, `expires_at`, `resume_at_ms`, `poster_url`, `thumbs_vtt_url`. POST (not GET) so it's never cached |

### Library (auth required)
| Method | Path | Description |
|---|---|---|
| PUT | `/me/progress/{videoId}` | `{position_ms, duration_ms}` → 204 (buffered) |
| GET | `/me/history?cursor=` | «Недавно смотрели» |
| GET | `/me/continue` | continue-watching rail with resume positions |
| GET | `/me/lists/{list}?cursor=` | `list = watchlist \| liked` |
| PUT | `/me/lists/{list}/{titleId}` | add (idempotent) → 204 |
| DELETE | `/me/lists/{list}/{titleId}` | remove → 204 |
| PUT / DELETE | `/me/trailer-likes/{trailerId}` | «Нравится» in the feed |
| POST | `/events` | batched player QoE events (startup ms, rebuffer, bitrate switches) |

### Admin / CMS (role `admin`)
| Method | Path | Description |
|---|---|---|
| POST | `/admin/uploads` | `{filename, size_bytes, content_type}` → `{video_id, upload_id, part_size, parts: [{n, url}]}` (S3 multipart presigned) |
| POST | `/admin/uploads/{videoId}/complete` | `{parts: [{n, etag}]}` → completes upload, enqueues transcode |
| GET | `/admin/videos/{id}` | status `queued → processing → ready/failed`, progress % |
| POST | `/admin/videos/{id}/reencode` | bump `encode_version`, re-run ladder |
| POST / PATCH / DELETE | `/admin/titles[/{id}]` | CRUD titles |
| POST / PATCH | `/admin/titles/{id}/seasons`, `/admin/seasons/{id}/episodes` | series structure |
| POST / PATCH | `/admin/trailers`, `/admin/collections` | trailers & reels |
| POST | `/admin/titles/{id}/publish` | sets `published_at`, invalidates Valkey + calls Next `revalidateTag` |

## Example payloads
`GET /api/v1/feed/trailers`
```json
{
  "items": [
    {
      "id": "0192f0c1-…",
      "kind": "trailer",
      "name": "Северный ветер — трейлер",
      "note": "Смотритель маяка получает письмо от сына, которого не видел двадцать лет.",
      "duration_ms": 110000,
      "video_id": "0192f0c1-…",
      "poster_key": "img/0192…/poster.jpg",
      "liked": false,
      "title": { "slug": "severnyi-veter", "title": "Северный ветер", "kind": "film",
                 "genres": ["Драма"], "release_label": "уже в библиотеке", "in_watchlist": true }
    }
  ],
  "next_cursor": "eyJyIjo5MCwidCI6IjIwMjYtMTAtMjgifQ"
}
```

`POST /api/v1/videos/{id}/playback`
```json
{
  "manifest_url": "https://cdn.kadr.example/t/1793500000/Xk3…/v/0192f0c1/3/master.m3u8",
  "expires_at": "2026-11-01T04:33:00Z",
  "resume_at_ms": 312000,
  "poster_url": "https://img.kadr.example/img/0192…/poster.jpg?w=1080",
  "thumbs_vtt_url": "https://cdn.kadr.example/t/…/v/0192f0c1/3/thumbs.vtt"
}
```

## Go: session middleware sketch
```go
// internal/platform/auth/middleware.go
// LoadSession resolves the cookie to a user; anonymous requests pass through.
func (m *Middleware) LoadSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie("kadr_session")
		if err != nil || c.Value == "" {
			next.ServeHTTP(w, r)
			return
		}
		sum := sha256.Sum256([]byte(c.Value)) // DB stores only the hash
		u, err := m.sessions.UserByTokenHash(r.Context(), sum[:]) // Valkey → Postgres fallback
		if err == nil {
			r = r.WithContext(WithUser(r.Context(), u))
		}
		next.ServeHTTP(w, r)
	})
}

// RequireUser returns 401 when no user is attached.
func (m *Middleware) RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := UserFrom(r.Context()); !ok {
			httpx.Error(w, r, http.StatusUnauthorized, "unauthorized", "Login required")
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

## Лог изменений
- 2026-11-01 — MVP endpoint list.
