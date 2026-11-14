// Package store owns the SQLite database: schema, seed data and every query the API needs.
package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite" // pure-Go driver, registers "sqlite"
)

//go:embed schema.sql
var schemaSQL string

//go:embed seed.json
var seedJSON []byte

var (
	ErrNotFound    = errors.New("not found")
	ErrHandleTaken = errors.New("handle taken")
)

type Store struct {
	db *sql.DB
}

// Open creates the data directory and database file if needed, applies the schema
// and seeds the design's content on first start.
func Open(ctx context.Context, dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	dsn := "file:" + filepath.ToSlash(filepath.Join(dataDir, "kadr.db")) +
		"?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// SQLite allows one writer; a single connection avoids "database is locked" in the prototype.
	db.SetMaxOpenConns(1)

	s := &Store{db: db}
	if err := s.resetIfOutdated(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("schema version: %w", err)
	}
	if _, err := db.ExecContext(ctx, schemaSQL); err != nil {
		db.Close()
		return nil, fmt.Errorf("schema: %w", err)
	}
	if err := s.seedIfEmpty(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("seed: %w", err)
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

// schemaVersion is stored in PRAGMA user_version. The prototype has no migrations:
// a database from an older schema is dropped and re-seeded (demo data only).
// Bump it when schema.sql or seed.json changes. 13: «Ракка» is the hero; real titles first.
const schemaVersion = 13

func (s *Store) resetIfOutdated(ctx context.Context) error {
	var v int
	if err := s.db.QueryRowContext(ctx, `PRAGMA user_version`).Scan(&v); err != nil {
		return err
	}
	if v >= schemaVersion {
		return nil
	}
	if _, err := s.db.ExecContext(ctx, `PRAGMA foreign_keys = OFF;
		DROP TABLE IF EXISTS list_items; DROP TABLE IF EXISTS collection_items; DROP TABLE IF EXISTS collections;
		DROP TABLE IF EXISTS trailers; DROP TABLE IF EXISTS titles; DROP TABLE IF EXISTS site_settings;
		DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS users;
		PRAGMA foreign_keys = ON;`); err != nil {
		return err
	}
	_, err := s.db.ExecContext(ctx, fmt.Sprintf(`PRAGMA user_version = %d`, schemaVersion))
	return err
}

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// ───────────── Seed ─────────────

type seedFile struct {
	DemoUser struct {
		Handle      string `json:"handle"`
		DisplayName string `json:"display_name"`
	} `json:"demo_user"`
	HeroTrailer string `json:"hero_trailer"`
	Titles      []struct {
		Slug, Kind, Title, Genre, Runtime, Logline, Bg, Ink, Shape string
		Year, Minutes                                              int
		Age                                                        string // age rating, '18+'
		Poster                                                     string // web path; "" = abstract art
		Original, Country, Director                                string // title page details (Kinopoisk)
		Cast                                                       []string
		Episodes                                                   int    // series only
		EpisodeLength                                              string // series only
	} `json:"titles"`
	Trailers []struct {
		Title, Kind, Length, Release, Note, Shape string
		Video                                     string // path under the media dir; "" = placeholder art
		Landscape                                 bool   // horizontal video
		Source, SourceLabel                       string // where the trailer comes from: URL + «YouTube»
	} `json:"trailers"`
	Collections []struct {
		Slug, Name, Bg string
		Titles         []string
	} `json:"collections"`
	Lists map[string][]string `json:"lists"`
}

// episodeSeconds parses an episode length label: "1:20" → 80, "8 мин" → 480; anything else → 0.
func episodeSeconds(label string) int {
	label = strings.TrimSpace(label)
	if m, s, ok := strings.Cut(label, ":"); ok {
		mi, err1 := strconv.Atoi(m)
		si, err2 := strconv.Atoi(s)
		if err1 == nil && err2 == nil {
			return mi*60 + si
		}
		return 0
	}
	if n, err := strconv.Atoi(strings.TrimSpace(strings.TrimSuffix(label, "мин"))); err == nil {
		return n * 60
	}
	return 0
}

// nullIfEmpty stores "" as NULL for optional text columns.
func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func (s *Store) seedIfEmpty(ctx context.Context) error {
	var n int
	if err := s.db.QueryRowContext(ctx, `SELECT count(*) FROM titles`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	var sf seedFile
	if err := json.Unmarshal(seedJSON, &sf); err != nil {
		return err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Titles are added newest-first in the file: give each an earlier added_at than the one before.
	titleID := map[string]string{}
	base := time.Now().UTC()
	for i, t := range sf.Titles {
		id := newID()
		titleID[t.Slug] = id
		added := base.Add(-time.Duration(i) * time.Hour).Format(time.RFC3339)
		if _, err := tx.ExecContext(ctx, `INSERT INTO titles
			(id, kind, slug, title, logline, genre, year, runtime, duration_min, poster, age_rating,
			 original_title, country, director, cast_list, episodes, episode_length, episode_seconds, art_bg, art_ink, art_shape, added_at)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			id, t.Kind, t.Slug, t.Title, t.Logline, t.Genre, t.Year, t.Runtime, t.Minutes, nullIfEmpty(t.Poster), t.Age,
			t.Original, t.Country, t.Director, strings.Join(t.Cast, ";"), t.Episodes, t.EpisodeLength, episodeSeconds(t.EpisodeLength),
			t.Bg, t.Ink, t.Shape, added); err != nil {
			return fmt.Errorf("title %s: %w", t.Slug, err)
		}
	}

	for i, tr := range sf.Trailers {
		tid, ok := titleID[tr.Title]
		if !ok {
			return fmt.Errorf("trailer for unknown title %q", tr.Title)
		}
		id := newID()
		if _, err := tx.ExecContext(ctx, `INSERT INTO trailers
			(id, title_id, kind, name, note, length, release_label, art_shape, video_file, video_landscape,
			 source_url, source_label, feed_rank)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			id, tid, tr.Kind, "", tr.Note, tr.Length, tr.Release, tr.Shape, nullIfEmpty(tr.Video), tr.Landscape,
			nullIfEmpty(tr.Source), tr.SourceLabel, len(sf.Trailers)-i); err != nil {
			return err
		}
		if tr.Title == sf.HeroTrailer {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO site_settings (key, value) VALUES ('hero_trailer_id', ?)`, id); err != nil {
				return err
			}
		}
	}

	for i, c := range sf.Collections {
		cid := newID()
		if _, err := tx.ExecContext(ctx, `INSERT INTO collections (id, slug, name, art_bg, position) VALUES (?,?,?,?,?)`,
			cid, c.Slug, c.Name, c.Bg, i); err != nil {
			return err
		}
		for j, slug := range c.Titles {
			if _, err := tx.ExecContext(ctx, `INSERT INTO collection_items (collection_id, title_id, position) VALUES (?,?,?)`,
				cid, titleID[slug], j); err != nil {
				return fmt.Errorf("collection %s/%s: %w", c.Slug, slug, err)
			}
		}
	}

	uid := newID()
	if _, err := tx.ExecContext(ctx, `INSERT INTO users (id, handle, display_name) VALUES (?,?,?)`,
		uid, sf.DemoUser.Handle, sf.DemoUser.DisplayName); err != nil {
		return err
	}
	for list, slugs := range sf.Lists {
		// Insert in reverse so the first slug in the file is the newest list entry.
		for i := len(slugs) - 1; i >= 0; i-- {
			if _, err := tx.ExecContext(ctx, `INSERT INTO list_items (user_id, list, title_id, created_at)
				VALUES (?,?,?, strftime('%Y-%m-%d %H:%M:%f','now', ?))`,
				uid, list, titleID[slugs[i]], fmt.Sprintf("-%d seconds", i)); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}

// ───────────── Users & sessions ─────────────

type User struct {
	ID          string  `json:"id"`
	Handle      string  `json:"handle"`
	DisplayName string  `json:"display_name"`
	AvatarFile  *string `json:"-"`
}

const userCols = `u.id, u.handle, u.display_name, u.avatar_file`

func scanUser(row interface{ Scan(...any) error }) (User, error) {
	var u User
	err := row.Scan(&u.ID, &u.Handle, &u.DisplayName, &u.AvatarFile)
	if errors.Is(err, sql.ErrNoRows) {
		return u, ErrNotFound
	}
	return u, err
}

// DemoUser returns the single seeded account (the oldest user).
func (s *Store) DemoUser(ctx context.Context) (User, error) {
	return scanUser(s.db.QueryRowContext(ctx,
		`SELECT `+userCols+` FROM users u ORDER BY u.created_at, u.rowid LIMIT 1`))
}

func (s *Store) CreateSession(ctx context.Context, tokenHash []byte, userID string, expires time.Time) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)`,
		tokenHash, userID, expires.Unix())
	return err
}

func (s *Store) DeleteSession(ctx context.Context, tokenHash []byte) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = ?`, tokenHash)
	return err
}

func (s *Store) UserBySession(ctx context.Context, tokenHash []byte) (User, error) {
	return scanUser(s.db.QueryRowContext(ctx, `SELECT `+userCols+`
		FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = ? AND s.expires_at > ?`, tokenHash, time.Now().Unix()))
}

func (s *Store) UpdateProfile(ctx context.Context, userID, displayName, handle string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE users SET display_name = ?, handle = ? WHERE id = ?`,
		displayName, handle, userID)
	if err != nil && strings.Contains(err.Error(), "UNIQUE") {
		return ErrHandleTaken
	}
	return err
}

// SetAvatar stores the new file name and returns the previous one so the caller can delete it.
func (s *Store) SetAvatar(ctx context.Context, userID, file string) (prev *string, err error) {
	if err := s.db.QueryRowContext(ctx, `SELECT avatar_file FROM users WHERE id = ?`, userID).Scan(&prev); err != nil {
		return nil, err
	}
	_, err = s.db.ExecContext(ctx, `UPDATE users SET avatar_file = ? WHERE id = ?`, file, userID)
	return prev, err
}

// ───────────── Catalog ─────────────

type Art struct {
	Bg    string `json:"bg"`
	Ink   string `json:"ink"`
	Shape string `json:"shape"`
}

type TitleCard struct {
	ID          string  `json:"id"`
	Slug        string  `json:"slug"`
	Kind        string  `json:"kind"`
	Title       string  `json:"title"`
	Genre       string  `json:"genre"`
	Runtime     string  `json:"runtime"`
	DurationMin int     `json:"duration_min"`
	Logline     string  `json:"logline"`
	Poster      *string `json:"poster"`     // web path of a real poster; nil = abstract art
	AgeRating   string  `json:"age_rating"` // '18+'
	// Series only: how many episodes and how long one is, for «Успеете N серий» under the time filter.
	Episodes       int `json:"episodes"`
	EpisodeSeconds int `json:"episode_seconds"`
	Art            Art `json:"art"`
}

const titleCols = `t.id, t.slug, t.kind, t.title, t.genre, t.runtime, t.duration_min, t.logline, t.poster, t.age_rating,
	t.episodes, t.episode_seconds, t.art_bg, t.art_ink, t.art_shape`

// titleDest lists TitleCard fields in titleCols order.
func titleDest(t *TitleCard) []any {
	return []any{&t.ID, &t.Slug, &t.Kind, &t.Title, &t.Genre, &t.Runtime, &t.DurationMin, &t.Logline, &t.Poster, &t.AgeRating,
		&t.Episodes, &t.EpisodeSeconds, &t.Art.Bg, &t.Art.Ink, &t.Art.Shape}
}

func scanTitle(row interface{ Scan(...any) error }) (TitleCard, error) {
	var t TitleCard
	err := row.Scan(titleDest(&t)...)
	return t, err
}

func collectTitles(rows *sql.Rows, err error) ([]TitleCard, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TitleCard{}
	for rows.Next() {
		t, err := scanTitle(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// NewTitles is the «Новое в библиотеке» rail; excludeID keeps the hero's title out of it.
// f narrows the rail by kind, length and genres (its Collection is ignored).
func (s *Store) NewTitles(ctx context.Context, excludeID string, limit int, f FeedFilter) ([]TitleCard, error) {
	where, args := titleFilterSQL(f)
	args = append([]any{excludeID}, args...)
	return collectTitles(s.db.QueryContext(ctx, `SELECT `+titleCols+` FROM titles t
		WHERE t.id <> ?`+where+` ORDER BY (t.poster IS NOT NULL) DESC, t.added_at DESC LIMIT ?`, append(args, limit)...))
}

// TitleDetail is the title page: the card plus the «О фильме» facts. Empty facts are hidden.
type TitleDetail struct {
	TitleCard
	Year          int      `json:"year"`
	OriginalTitle string   `json:"original_title"`
	Country       string   `json:"country"`
	Director      string   `json:"director"`
	Cast          []string `json:"cast"`
	EpisodeLength string   `json:"episode_length"` // series only (the count is TitleCard.Episodes)
	TrailerID     *string  `json:"trailer_id"`     // its top trailer, for «Смотреть трейлер»
}

func (s *Store) TitleBySlug(ctx context.Context, slug string) (TitleDetail, error) {
	var d TitleDetail
	var year sql.NullInt64
	var cast string
	dest := append(titleDest(&d.TitleCard), &year, &d.OriginalTitle, &d.Country, &d.Director, &cast, &d.EpisodeLength, &d.TrailerID)
	err := s.db.QueryRowContext(ctx, `SELECT `+titleCols+`, t.year, t.original_title, t.country, t.director, t.cast_list,
		t.episode_length,
		(SELECT tr.id FROM trailers tr WHERE tr.title_id = t.id ORDER BY tr.feed_rank DESC LIMIT 1)
		FROM titles t WHERE t.slug = ?`, slug).Scan(dest...)
	if errors.Is(err, sql.ErrNoRows) {
		return d, ErrNotFound
	}
	d.Year = int(year.Int64)
	d.Cast = []string{}
	if cast != "" {
		d.Cast = strings.Split(cast, ";")
	}
	return d, err
}

// Similar lists other titles for «Похожие»: our real titles first, then same genre, same kind, newest.
func (s *Store) Similar(ctx context.Context, t TitleCard, limit int) ([]TitleCard, error) {
	return collectTitles(s.db.QueryContext(ctx, `SELECT `+titleCols+` FROM titles t WHERE t.id <> ?
		ORDER BY (t.poster IS NOT NULL) DESC, (t.genre = ?) DESC, (t.kind = ?) DESC, t.added_at DESC LIMIT ?`, t.ID, t.Genre, t.Kind, limit))
}

func (s *Store) TitleExists(ctx context.Context, id string) (bool, error) {
	var n int
	err := s.db.QueryRowContext(ctx, `SELECT count(*) FROM titles WHERE id = ?`, id).Scan(&n)
	return n > 0, err
}

type Reel struct {
	Slug  string `json:"slug"`
	Name  string `json:"name"`
	Bg    string `json:"bg"`
	Count int    `json:"count"`
}

func (s *Store) Reels(ctx context.Context) ([]Reel, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT c.slug, c.name, c.art_bg, count(ci.title_id)
		FROM collections c LEFT JOIN collection_items ci ON ci.collection_id = c.id
		GROUP BY c.id ORDER BY c.position`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Reel{}
	for rows.Next() {
		var r Reel
		if err := rows.Scan(&r.Slug, &r.Name, &r.Bg, &r.Count); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// Genres is the fixed list for the genre filter, in display order. Every title uses one of them.
var Genres = []string{"Триллер", "Детектив", "Драма", "Ужасы"}

type Trailer struct {
	ID             string    `json:"id"`
	Kind           string    `json:"kind"`
	Note           string    `json:"note"`
	Length         string    `json:"length"`
	ReleaseLabel   string    `json:"release_label"`
	Art            Art       `json:"art"` // 9:16 art: title colours + trailer shape
	HasVideo       bool      `json:"-"`   // the handler turns this into video_url
	VideoLandscape bool      `json:"video_landscape"`
	SourceURL      *string   `json:"source_url"`   // where the trailer comes from; nil for placeholders
	SourceLabel    string    `json:"source_label"` // «YouTube»
	Title          TitleCard `json:"title"`
}

const trailerQuery = `SELECT tr.id, tr.kind, tr.note, tr.length, tr.release_label,
	CASE WHEN tr.art_shape <> '' THEN tr.art_shape ELSE t.art_shape END,
	tr.video_file IS NOT NULL, tr.video_landscape, tr.source_url, tr.source_label, ` + titleCols + `
	FROM trailers tr JOIN titles t ON t.id = tr.title_id`

func scanTrailer(row interface{ Scan(...any) error }) (Trailer, error) {
	var tr Trailer
	dest := append([]any{&tr.ID, &tr.Kind, &tr.Note, &tr.Length, &tr.ReleaseLabel, &tr.Art.Shape, &tr.HasVideo, &tr.VideoLandscape,
		&tr.SourceURL, &tr.SourceLabel}, titleDest(&tr.Title)...)
	err := row.Scan(dest...)
	tr.Art.Bg, tr.Art.Ink = tr.Title.Art.Bg, tr.Title.Art.Ink
	return tr, err
}

// HeroTrailer returns the admin-selected «Трейлер недели», falling back to the top of the feed.
func (s *Store) HeroTrailer(ctx context.Context) (Trailer, error) {
	tr, err := scanTrailer(s.db.QueryRowContext(ctx, trailerQuery+`
		WHERE tr.id = (SELECT value FROM site_settings WHERE key = 'hero_trailer_id')`))
	if errors.Is(err, sql.ErrNoRows) {
		tr, err = scanTrailer(s.db.QueryRowContext(ctx, trailerQuery+` ORDER BY tr.feed_rank DESC LIMIT 1`))
	}
	if errors.Is(err, sql.ErrNoRows) {
		return tr, ErrNotFound
	}
	return tr, err
}

// FeedFilter narrows the feed; zero values mean "no filter".
type FeedFilter struct {
	Collection string   // reel slug: only its titles, in the reel's order
	Kind       string   // 'film' («Короткометражки») or 'series' («Микро-сериалы»)
	MaxMin     int      // «Время»: film length or one episode ≤ MaxMin
	Genres     []string // any of these genres
}

// titleFilterSQL turns f's kind / length / genre filters into " AND …" clauses on titles t.
func titleFilterSQL(f FeedFilter) (string, []any) {
	var sb strings.Builder
	var args []any
	if f.Kind != "" {
		sb.WriteString(` AND t.kind = ?`)
		args = append(args, f.Kind)
	}
	if f.MaxMin > 0 {
		// «Время» hides only films that don't fit; series always show (the card says how many episodes fit).
		sb.WriteString(` AND (t.kind = 'series' OR t.duration_min <= ?)`)
		args = append(args, f.MaxMin)
	}
	if len(f.Genres) > 0 {
		sb.WriteString(` AND t.genre IN (?` + strings.Repeat(",?", len(f.Genres)-1) + `)`)
		for _, g := range f.Genres {
			args = append(args, g)
		}
	}
	return sb.String(), args
}

// Feed lists trailers in feed order (or reel order), filtered by f.
func (s *Store) Feed(ctx context.Context, f FeedFilter) ([]Trailer, error) {
	q := trailerQuery
	args := []any{}
	order := ` ORDER BY (tr.video_file IS NOT NULL) DESC, tr.feed_rank DESC`
	if f.Collection != "" {
		q += `
			JOIN collection_items ci ON ci.title_id = t.id
			JOIN collections c ON c.id = ci.collection_id AND c.slug = ?`
		args = append(args, f.Collection)
		order = ` ORDER BY (tr.video_file IS NOT NULL) DESC, ci.position`
	}
	where, fargs := titleFilterSQL(f)
	q += ` WHERE 1 = 1` + where
	args = append(args, fargs...)
	rows, err := s.db.QueryContext(ctx, q+order, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Trailer{}
	for rows.Next() {
		tr, err := scanTrailer(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, tr)
	}
	return out, rows.Err()
}

// TrailerVideo returns the trailer's video path under the media dir, or ErrNotFound.
func (s *Store) TrailerVideo(ctx context.Context, trailerID string) (string, error) {
	var file sql.NullString
	err := s.db.QueryRowContext(ctx, `SELECT video_file FROM trailers WHERE id = ?`, trailerID).Scan(&file)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !file.Valid) {
		return "", ErrNotFound
	}
	return file.String, err
}

// SetHeroBySlug points «Трейлер недели» at the top-ranked trailer of the title with that slug.
func (s *Store) SetHeroBySlug(ctx context.Context, slug string) error {
	var id string
	err := s.db.QueryRowContext(ctx, `SELECT tr.id FROM trailers tr JOIN titles t ON t.id = tr.title_id
		WHERE t.slug = ? ORDER BY tr.feed_rank DESC LIMIT 1`, slug).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO site_settings (key, value) VALUES ('hero_trailer_id', ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`, id)
	return err
}

// ───────────── Library ─────────────

func (s *Store) List(ctx context.Context, userID, list string) ([]TitleCard, error) {
	return collectTitles(s.db.QueryContext(ctx, `SELECT `+titleCols+`
		FROM list_items li JOIN titles t ON t.id = li.title_id
		WHERE li.user_id = ? AND li.list = ? ORDER BY li.created_at DESC`, userID, list))
}

// ListMembership returns the title ids in each of the user's lists.
func (s *Store) ListMembership(ctx context.Context, userID string) (map[string]map[string]bool, error) {
	out := map[string]map[string]bool{"watchlist": {}, "watched": {}}
	rows, err := s.db.QueryContext(ctx, `SELECT list, title_id FROM list_items WHERE user_id = ?`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var list, id string
		if err := rows.Scan(&list, &id); err != nil {
			return nil, err
		}
		out[list][id] = true
	}
	return out, rows.Err()
}

func (s *Store) AddToList(ctx context.Context, userID, list, titleID string) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO list_items (user_id, list, title_id) VALUES (?,?,?)
		ON CONFLICT DO NOTHING`, userID, list, titleID)
	return err
}

func (s *Store) RemoveFromList(ctx context.Context, userID, list, titleID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM list_items WHERE user_id = ? AND list = ? AND title_id = ?`,
		userID, list, titleID)
	return err
}
