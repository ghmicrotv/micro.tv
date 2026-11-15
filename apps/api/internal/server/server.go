// Package server is the HTTP layer of the prototype API: routes, session middleware and handlers.
package server

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/kinosite/api/internal/store"
)

const (
	sessionCookie   = "kadr_session"
	signedOutCookie = "kadr_signed_out" // set on logout so auto sign-in doesn't undo it
	sessionTTL      = 30 * 24 * time.Hour
)

type Server struct {
	store     *store.Store
	uploadDir string
	mediaDir  string // trailer MP4s (KADR_MEDIA)
}

func New(s *store.Store, uploadDir, mediaDir string) *Server {
	return &Server{store: s, uploadDir: uploadDir, mediaDir: mediaDir}
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.Logger, middleware.Recoverer)
	r.Use(middleware.Timeout(15 * time.Second))
r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if origin := r.Header.Get("Origin"); origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	})
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(s.loadSession)

		r.Post("/auth/demo", s.demoLogin)
		r.Post("/auth/logout", s.logout)

		r.Get("/home", s.home)
		r.Get("/feed/trailers", s.feed)
		r.Get("/genres", s.genres)
		r.Get("/titles/{slug}", s.title)
		r.Get("/trailers/{id}/video", s.trailerVideo)
		r.Get("/uploads/{file}", s.upload)

		r.Group(func(r chi.Router) {
			r.Use(requireUser)
			r.Get("/me", s.me)
			r.Patch("/me", s.updateMe)
			r.Post("/me/avatar", s.uploadAvatar)
			r.Get("/me/lists/{list}", s.list)
			r.Put("/me/lists/{list}/{titleID}", s.addToList)
			r.Delete("/me/lists/{list}/{titleID}", s.removeFromList)
		})
	})
	return r
}

// ───────────── Sessions ─────────────

type ctxKey struct{}

func userFrom(ctx context.Context) (store.User, bool) {
	u, ok := ctx.Value(ctxKey{}).(store.User)
	return u, ok
}

func hashToken(t string) []byte {
	sum := sha256.Sum256([]byte(t))
	return sum[:]
}

// loadSession attaches the signed-in user to the context. A visitor with no session who
// has not signed out is signed in as the demo user automatically (prototype only).
func (s *Server) loadSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
			if u, err := s.store.UserBySession(r.Context(), hashToken(c.Value)); err == nil {
				next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, u)))
				return
			}
		}
		if _, err := r.Cookie(signedOutCookie); err != nil {
			if u, err := s.startDemoSession(w, r); err == nil {
				r = r.WithContext(context.WithValue(r.Context(), ctxKey{}, u))
			} else {
				slog.Error("auto sign-in failed", "err", err)
			}
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) startDemoSession(w http.ResponseWriter, r *http.Request) (store.User, error) {
	u, err := s.store.DemoUser(r.Context())
	if err != nil {
		return u, err
	}
	raw := make([]byte, 32)
	_, _ = rand.Read(raw)
	token := base64.RawURLEncoding.EncodeToString(raw)
	expires := time.Now().Add(sessionTTL)
	if err := s.store.CreateSession(r.Context(), hashToken(token), u.ID, expires); err != nil {
		return u, err
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: token, Path: "/", Expires: expires,
		HttpOnly: true, SameSite: http.SameSiteNoneMode, Secure: true})
	http.SetCookie(w, &http.Cookie{Name: signedOutCookie, Value: "", Path: "/", MaxAge: -1})
	return u, nil
}

func requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := userFrom(r.Context()); !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Нужно войти")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) demoLogin(w http.ResponseWriter, r *http.Request) {
	u, ok := userFrom(r.Context())
	if !ok {
		var err error
		if u, err = s.startDemoSession(w, r); err != nil {
			internalError(w, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, s.userDTO(u))
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		_ = s.store.DeleteSession(r.Context(), hashToken(c.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	http.SetCookie(w, &http.Cookie{Name: signedOutCookie, Value: "1", Path: "/", MaxAge: int(sessionTTL.Seconds()),
		SameSite: http.SameSiteNoneMode, Secure: true})
	w.WriteHeader(http.StatusNoContent)
}

// ───────────── JSON helpers ─────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": msg}})
}

func internalError(w http.ResponseWriter, err error) {
	slog.Error("internal error", "err", err)
	writeError(w, http.StatusInternalServerError, "internal", "Что-то пошло не так")
}

func isNotFound(err error) bool { return errors.Is(err, store.ErrNotFound) }
