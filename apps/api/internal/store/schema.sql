-- Prototype schema (SQLite). A trimmed version of docs/04_Database_Schema.md:
-- no videos, seasons or episodes yet; posters are abstract art blocks (art_*).
-- Bump schemaVersion in store.go when this file changes: an older database is rebuilt from the seed.

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  handle       TEXT NOT NULL UNIQUE,              -- maria.k (shown as @maria.k)
  display_name TEXT NOT NULL,
  avatar_file  TEXT,                              -- file name under data/uploads
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash BLOB PRIMARY KEY,                    -- sha256(token); raw token only in the cookie
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL                     -- unix seconds
);

CREATE TABLE IF NOT EXISTS titles (
  id        TEXT PRIMARY KEY,
  kind      TEXT NOT NULL CHECK (kind IN ('film','series')),
  slug      TEXT NOT NULL UNIQUE,
  title     TEXT NOT NULL,
  logline   TEXT NOT NULL DEFAULT '',
  genre     TEXT NOT NULL DEFAULT '',
  year      INTEGER,
  runtime   TEXT NOT NULL DEFAULT '',             -- display label: '28 мин', '8 серий · 4 мин'
  duration_min INTEGER NOT NULL DEFAULT 0,        -- film length, or one episode for series («Время» filter)
  poster    TEXT,                                 -- real poster, a web path like /posters/rakka.webp; NULL = abstract art
  age_rating TEXT NOT NULL DEFAULT '',            -- '18+', '16+', '12+' (Kinopoisk where it has one)
  -- Title page details (Kinopoisk where the title is listed; empty = the row is hidden)
  original_title TEXT NOT NULL DEFAULT '',
  country        TEXT NOT NULL DEFAULT '',
  director       TEXT NOT NULL DEFAULT '',
  cast_list      TEXT NOT NULL DEFAULT '',        -- names separated by «;»
  episodes       INTEGER NOT NULL DEFAULT 0,      -- series only
  episode_length TEXT NOT NULL DEFAULT '',        -- series only: '1:20', '8 мин'
  episode_seconds INTEGER NOT NULL DEFAULT 0,     -- series only: the same length in seconds («Успеете N серий»)
  art_bg    TEXT NOT NULL,                        -- poster placeholder: background colour
  art_ink   TEXT NOT NULL,                        -- text colour on the poster
  art_shape TEXT NOT NULL DEFAULT '',             -- inline CSS of the decorative shape
  added_at  TEXT NOT NULL                         -- «Новое в библиотеке» order
);

CREATE TABLE IF NOT EXISTS trailers (
  id            TEXT PRIMARY KEY,
  title_id      TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('trailer','teaser','clip','bts')),
  name          TEXT NOT NULL,
  note          TEXT NOT NULL DEFAULT '',         -- the feed's caption
  length        TEXT NOT NULL DEFAULT '',         -- '1:50'
  release_label TEXT NOT NULL DEFAULT '',         -- 'уже в библиотеке' (plain text for now)
  art_shape     TEXT NOT NULL DEFAULT '',         -- 9:16 variant of the title's shape
  video_file    TEXT,                             -- MP4 path under the media dir (KADR_MEDIA); NULL = placeholder art
  video_landscape INTEGER NOT NULL DEFAULT 0,     -- 1 = horizontal video (the player turns wide on wide screens)
  source_url    TEXT,                             -- where the trailer comes from (shown on the card)
  source_label  TEXT NOT NULL DEFAULT '',         -- 'YouTube'
  feed_rank     INTEGER NOT NULL DEFAULT 0        -- higher = earlier in the feed
);

CREATE TABLE IF NOT EXISTS collections (
  id       TEXT PRIMARY KEY,
  slug     TEXT NOT NULL UNIQUE,
  name     TEXT NOT NULL,
  art_bg   TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  title_id      TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  PRIMARY KEY (collection_id, title_id)
);

-- «Хочу посмотреть» (user-editable) / «Просмотренные» (static demo list from the seed for now)
CREATE TABLE IF NOT EXISTS list_items (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  list       TEXT NOT NULL CHECK (list IN ('watchlist','watched')),
  title_id   TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
  PRIMARY KEY (user_id, list, title_id)
);

-- Admin-controlled values, e.g. hero_trailer_id («Трейлер недели»).
CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
