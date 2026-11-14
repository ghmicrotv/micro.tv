package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"github.com/kinosite/api/internal/store"
)

// ───────────── Catalog ─────────────

type trailerDTO struct {
	store.Trailer
	VideoURL    *string `json:"video_url"` // nil = placeholder art only
	InWatchlist bool    `json:"in_watchlist"`
}

// withMembership marks each trailer with the signed-in user's list state.
func (s *Server) withMembership(r *http.Request, trs []store.Trailer) ([]trailerDTO, error) {
	var lists map[string]map[string]bool
	if u, ok := userFrom(r.Context()); ok {
		var err error
		if lists, err = s.store.ListMembership(r.Context(), u.ID); err != nil {
			return nil, err
		}
	}
	out := make([]trailerDTO, len(trs))
	for i, tr := range trs {
		out[i] = trailerDTO{Trailer: tr, InWatchlist: lists["watchlist"][tr.Title.ID]}
		if tr.HasVideo {
			url := "/api/v1/trailers/" + tr.ID + "/video"
			out[i].VideoURL = &url
		}
	}
	return out, nil
}

func (s *Server) home(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	hero, err := s.store.HeroTrailer(ctx)
	if err != nil && !isNotFound(err) {
		internalError(w, err)
		return
	}
	var heroOut *trailerDTO
	if err == nil {
		dto, err := s.withMembership(r, []store.Trailer{hero})
		if err != nil {
			internalError(w, err)
			return
		}
		heroOut = &dto[0]
	}
	// «Новое в библиотеке» follows the same filters as the feed; the hero is the admin's pick.
	newTitles, err := s.store.NewTitles(ctx, hero.Title.ID, 12, parseFilter(r.URL.Query()))
	if err != nil {
		internalError(w, err)
		return
	}
	reels, err := s.store.Reels(ctx)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"hero": heroOut, "new": newTitles, "reels": reels})
}

// validKind keeps only the two title kinds; anything else means "no kind filter".
func validKind(k string) string {
	if k == "film" || k == "series" {
		return k
	}
	return ""
}

// parseFilter reads ?kind=film|series&max_min=15&genre=Драма,Нуар (shared by /feed/trailers and /home).
func parseFilter(q url.Values) store.FeedFilter {
	f := store.FeedFilter{Kind: validKind(q.Get("kind"))}
	if n, err := strconv.Atoi(q.Get("max_min")); err == nil && n > 0 {
		f.MaxMin = n
	}
	for _, g := range strings.Split(q.Get("genre"), ",") {
		if g = strings.TrimSpace(g); g != "" && len(f.Genres) < 20 {
			f.Genres = append(f.Genres, g)
		}
	}
	return f
}

// feed handles GET /feed/trailers?collection=&kind=film|series&max_min=15&genre=Драма,Нуар
func (s *Server) feed(w http.ResponseWriter, r *http.Request) {
	f := parseFilter(r.URL.Query())
	f.Collection = r.URL.Query().Get("collection")
	trs, err := s.store.Feed(r.Context(), f)
	if err != nil {
		internalError(w, err)
		return
	}
	items, err := s.withMembership(r, trs)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// title handles GET /titles/{slug}: the title page with «Похожие» and the user's watchlist state.
func (s *Server) title(w http.ResponseWriter, r *http.Request) {
	d, err := s.store.TitleBySlug(r.Context(), chi.URLParam(r, "slug"))
	if isNotFound(err) {
		writeError(w, http.StatusNotFound, "title_not_found", "Фильм не найден")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	similar, err := s.store.Similar(r.Context(), d.TitleCard, 8)
	if err != nil {
		internalError(w, err)
		return
	}
	inWatchlist := false
	if u, ok := userFrom(r.Context()); ok {
		lists, err := s.store.ListMembership(r.Context(), u.ID)
		if err != nil {
			internalError(w, err)
			return
		}
		inWatchlist = lists["watchlist"][d.ID]
	}
	writeJSON(w, http.StatusOK, map[string]any{"title": d, "similar": similar, "in_watchlist": inWatchlist})
}

// trailerVideo streams a trailer's MP4. http.ServeFile handles Range requests, so the
// player can seek and start before the whole file arrives.
func (s *Server) trailerVideo(w http.ResponseWriter, r *http.Request) {
	rel, err := s.store.TrailerVideo(r.Context(), chi.URLParam(r, "id"))
	if isNotFound(err) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	// The path comes from the seed, but still refuse anything that escapes the media dir.
	full := filepath.Join(s.mediaDir, filepath.FromSlash(rel))
	if back, err := filepath.Rel(s.mediaDir, full); err != nil || back == ".." || strings.HasPrefix(back, ".."+string(filepath.Separator)) {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	http.ServeFile(w, r, full)
}

// genres handles GET /genres: always the same four, for films and series alike.
func (s *Server) genres(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"items": store.Genres})
}

// ───────────── Profile ─────────────

type userDTO struct {
	store.User
	AvatarURL *string `json:"avatar_url"`
}

func (s *Server) userDTO(u store.User) userDTO {
	d := userDTO{User: u}
	if u.AvatarFile != nil {
		url := "/api/v1/uploads/" + *u.AvatarFile
		d.AvatarURL = &url
	}
	return d
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	u, _ := userFrom(r.Context())
	writeJSON(w, http.StatusOK, s.userDTO(u))
}

var handleRe = regexp.MustCompile(`^[a-z0-9._]{3,24}$`)

func (s *Server) updateMe(w http.ResponseWriter, r *http.Request) {
	u, _ := userFrom(r.Context())
	var in struct {
		DisplayName string `json:"display_name"`
		Handle      string `json:"handle"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "bad_json", "Некорректный запрос")
		return
	}
	in.DisplayName = strings.TrimSpace(in.DisplayName)
	in.Handle = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(in.Handle), "@"))
	if n := utf8.RuneCountInString(in.DisplayName); n < 1 || n > 40 {
		writeError(w, http.StatusUnprocessableEntity, "bad_display_name", "Имя: от 1 до 40 символов")
		return
	}
	if !handleRe.MatchString(in.Handle) {
		writeError(w, http.StatusUnprocessableEntity, "bad_handle", "Ник: 3–24 символа, латиница, цифры, точка и _")
		return
	}
	switch err := s.store.UpdateProfile(r.Context(), u.ID, in.DisplayName, in.Handle); {
	case errors.Is(err, store.ErrHandleTaken):
		writeError(w, http.StatusConflict, "handle_taken", "Этот ник уже занят")
		return
	case err != nil:
		internalError(w, err)
		return
	}
	u.DisplayName, u.Handle = in.DisplayName, in.Handle
	writeJSON(w, http.StatusOK, s.userDTO(u))
}

const maxAvatarBytes = 2 << 20

var avatarExt = map[string]string{"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}

func (s *Server) uploadAvatar(w http.ResponseWriter, r *http.Request) {
	u, _ := userFrom(r.Context())
	r.Body = http.MaxBytesReader(w, r.Body, maxAvatarBytes+64<<10)
	file, _, err := r.FormFile("avatar")
	if err != nil {
		writeError(w, http.StatusBadRequest, "no_file", "Файл не получен или больше 2 МБ")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxAvatarBytes+1))
	if err != nil || len(data) > maxAvatarBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "too_large", "Файл больше 2 МБ")
		return
	}
	// Trust the bytes, not the client's filename or Content-Type.
	ext, ok := avatarExt[http.DetectContentType(data)]
	if !ok {
		writeError(w, http.StatusUnsupportedMediaType, "bad_type", "Нужна картинка PNG, JPG, WebP или GIF")
		return
	}
	if err := os.MkdirAll(s.uploadDir, 0o755); err != nil {
		internalError(w, err)
		return
	}
	name := fmt.Sprintf("%s-%d%s", u.ID, time.Now().UnixNano(), ext)
	if err := os.WriteFile(filepath.Join(s.uploadDir, name), data, 0o644); err != nil {
		internalError(w, err)
		return
	}
	prev, err := s.store.SetAvatar(r.Context(), u.ID, name)
	if err != nil {
		internalError(w, err)
		return
	}
	if prev != nil {
		_ = os.Remove(filepath.Join(s.uploadDir, filepath.Base(*prev)))
	}
	u.AvatarFile = &name
	writeJSON(w, http.StatusOK, s.userDTO(u))
}

func (s *Server) upload(w http.ResponseWriter, r *http.Request) {
	// filepath.Base strips any directory part, so only files in uploadDir are reachable.
	name := filepath.Base(chi.URLParam(r, "file"))
	if name == "." || name == string(filepath.Separator) {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable") // names are unique per upload
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeFile(w, r, filepath.Join(s.uploadDir, name))
}

// ───────────── Lists ─────────────

// «Хочу посмотреть» is the user's own list; «Просмотренные» is a static demo list for now (read-only).
func readableList(l string) bool { return l == "watchlist" || l == "watched" }
func writableList(l string) bool { return l == "watchlist" }

func (s *Server) list(w http.ResponseWriter, r *http.Request) {
	u, _ := userFrom(r.Context())
	l := chi.URLParam(r, "list")
	if !readableList(l) {
		writeError(w, http.StatusNotFound, "list_not_found", "Нет такого списка")
		return
	}
	items, err := s.store.List(r.Context(), u.ID, l)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) addToList(w http.ResponseWriter, r *http.Request)      { s.changeList(w, r, true) }
func (s *Server) removeFromList(w http.ResponseWriter, r *http.Request) { s.changeList(w, r, false) }

func (s *Server) changeList(w http.ResponseWriter, r *http.Request, add bool) {
	u, _ := userFrom(r.Context())
	l, titleID := chi.URLParam(r, "list"), chi.URLParam(r, "titleID")
	if !writableList(l) {
		writeError(w, http.StatusNotFound, "list_not_found", "Нет такого списка")
		return
	}
	var err error
	if add {
		var ok bool
		if ok, err = s.store.TitleExists(r.Context(), titleID); err == nil && !ok {
			writeError(w, http.StatusNotFound, "title_not_found", "Фильм не найден")
			return
		}
		if err == nil {
			err = s.store.AddToList(r.Context(), u.ID, l, titleID)
		}
	} else {
		err = s.store.RemoveFromList(r.Context(), u.ID, l, titleID)
	}
	if err != nil {
		internalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
