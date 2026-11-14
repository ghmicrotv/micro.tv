// Command api runs the prototype HTTP API on :8080 (override with KADR_ADDR).
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/kinosite/api/internal/server"
	"github.com/kinosite/api/internal/store"
)

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	dataDir := getenv("KADR_DATA", "data")
	st, err := store.Open(ctx, dataDir)
	if err != nil {
		slog.Error("open store", "err", err)
		os.Exit(1)
	}
	defer st.Close()

	srv := &http.Server{
		Addr: getenv("KADR_ADDR", ":8080"),
		// Trailer videos live in the repo's Media/ folder by default (run from apps/api).
		Handler:           server.New(st, filepath.Join(dataDir, "uploads"), getenv("KADR_MEDIA", filepath.Join("..", "..", "Media"))).Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		slog.Info("api listening", "addr", srv.Addr, "data", dataDir)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server error", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
