// Command admin holds the prototype's admin actions until there is a CMS.
//
//	go run ./cmd/admin hero <title-slug>   # set «Трейлер недели»
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/kinosite/api/internal/store"
)

func main() {
	if len(os.Args) != 3 || os.Args[1] != "hero" {
		fmt.Fprintln(os.Stderr, "usage: admin hero <title-slug>")
		os.Exit(2)
	}
	dataDir := os.Getenv("KADR_DATA")
	if dataDir == "" {
		dataDir = "data"
	}
	ctx := context.Background()
	st, err := store.Open(ctx, dataDir)
	if err != nil {
		fmt.Fprintln(os.Stderr, "open store:", err)
		os.Exit(1)
	}
	defer st.Close()

	if err := st.SetHeroBySlug(ctx, os.Args[2]); err != nil {
		fmt.Fprintf(os.Stderr, "set hero %q: %v\n", os.Args[2], err)
		os.Exit(1)
	}
	fmt.Printf("«Трейлер недели» → %s\n", os.Args[2])
}
