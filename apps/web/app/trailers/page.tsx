"use client";
// «Лента»: one vertical 9:16 card in a film strip, centered on every screen size.
// The previous, current and next trailers sit on one vertical track that slides like film:
// swipe drags it with the finger, wheel/arrows/keys animate it. Title, note and the watch button
// sit over the bottom of each frame, actions on its right edge. Trailers with a video play it;
// the rest show the title's abstract art.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { api, trailerKindLabel, type Trailer } from "@/lib/api";
import { useSaveToggle } from "@/lib/useSaveToggle";
import { feedHref, readFeedParams, titleHref } from "@/lib/feedParams";
import { fitSentence } from "@/lib/episodes";
import { RotateHint } from "@/components/feed/RotateHint";
import { useToast } from "@/components/ui/Toast";
import { Art } from "@/components/film/Art";

export default function TrailersPage() {
  return (
    <Suspense>
      <Feed />
    </Suspense>
  );
}

const icons = {
  comments: "M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.6A7.5 7.5 0 1 1 20 11.5z",
  save: "M6 3h12v18l-6-4-6 4z",
  share: "M12 15V3M7 8l5-5 5 5M5 13v7h14v-7",
};

const HINTS_KEY = "mtv_feed_hints_seen";
const GAP = 16; // px between frames on the strip
const SLIDE = "transform 420ms cubic-bezier(.2,.8,.2,1)"; // --ease-film
const SWIPE_PX = 60; // drag distance that switches the trailer
const PITCH = 24; // side sprockets: 12px hole + 12px gap; their offset wraps by this so moves are seamless

type Action = { name: string; on: boolean; d: string; fn: () => void };

function Feed() {
  const params = useSearchParams();
  // Filters are set by the header's FeedControls through the URL.
  const { kind, time, genres, reel, title: startTitle } = readFeedParams(params);
  const genresKey = genres.join(",");

  const [items, setItems] = useState<Trailer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [i, setI] = useState(0);
  // Playing is the default (autoplay); the ▶ overlay only shows after a real pause or a blocked start.
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 of the current video
  const [hints, setHints] = useState(false);

  // Track motion: shift −1 slides to the next frame, +1 to the previous; drag follows the finger.
  const [shift, setShift] = useState<-1 | 0 | 1>(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [instant, setInstant] = useState(false); // jump without animation after a slide lands
  // The side sprockets ride with the track: frameH is the frame height in px, sprocketBase the
  // leftover offset (mod PITCH) carried over from earlier slides.
  const [frameH, setFrameH] = useState(0);
  const [sprocketBase, setSprocketBase] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  // Autoplay: browsers refuse sound before the first tap, so playback falls back to muted.
  const [muted, setMuted] = useState(false);
  // Long press (hold ~0.5 s without moving) hides all interface; another long press brings it back.
  const [bare, setBare] = useState(false);
  const press = useRef<{ x: number; y: number; timer?: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);
  const mutedRef = useRef(false);
  const busy = useRef(false);
  const landTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touchY = useRef<number | null>(null);
  const lastWheel = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const toast = useToast();
  const saveToggle = useSaveToggle();

  // «Поверните телефон»: on entering the short-film feed with a phone held upright.
  // Closes on a tap (RotateHint) or by itself once the phone is turned.
  const [rotateHint, setRotateHint] = useState(false);
  useEffect(() => {
    if (kind !== "film") return setRotateHint(false);
    const upright = window.matchMedia("(orientation: portrait) and (max-width: 767.98px)");
    setRotateHint(upright.matches);
    const onChange = () => { if (!upright.matches) setRotateHint(false); };
    upright.addEventListener("change", onChange);
    return () => upright.removeEventListener("change", onChange);
  }, [kind]);

  // Tell how to come back when the interface disappears.
  useEffect(() => {
    if (bare) toast("Зажмите экран ещё раз, чтобы вернуть интерфейс");
  }, [bare, toast]);

  useEffect(() => {
    setItems(null);
    api.feed({ reel, kind, maxMin: time, genres: genresKey ? genresKey.split(",") : [] }).then(({ items }) => {
      setItems(items);
      const start = startTitle ? items.findIndex((t) => t.title.slug === startTitle) : 0;
      setI(Math.max(0, start));
    }, () => setFailed(true));
  }, [reel, kind, time, genresKey, startTitle]);

  // First-visit hint next to «Хочу посмотреть». A per-browser convenience only.
  useEffect(() => {
    try { setHints(!localStorage.getItem(HINTS_KEY)); } catch { /* storage blocked: no hints */ }
  }, []);
  const closeHints = useCallback(() => {
    setHints(false);
    try { localStorage.setItem(HINTS_KEY, "1"); } catch { /* ignore */ }
  }, []);

  const n = items?.length ?? 0;

  // After a slide lands: make the neighbour current and put the track back without animating.
  const land = useCallback((dir: 1 | -1) => {
    if (!busy.current) return; // already landed (transitionend and the fallback timer can both fire)
    clearTimeout(landTimer.current);
    flushSync(() => {
      setInstant(true);
      setI((v) => (v + dir + n) % n);
      setShift(0);
      setDrag(0);
      // Keep the sprockets where the slide left them, reduced mod PITCH (looks identical).
      setSprocketBase((b) => {
        const v = (b + (dir === 1 ? -1 : 1) * (frameH + GAP)) % PITCH;
        return v > 0 ? v - PITCH : v;
      });
    });
    trackRef.current?.getBoundingClientRect(); // apply the jump before transitions come back on
    setInstant(false);
    busy.current = false;
  }, [n, frameH]);

  const go = useCallback((dir: 1 | -1) => {
    if (n < 2 || busy.current) return;
    busy.current = true;
    setDragging(false);
    setDrag(0);
    // With reduced motion transitions are off, so there is no transitionend to wait for.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return land(dir);
    setShift(dir === 1 ? -1 : 1);
    // Start the incoming trailer while it slides in, so it is already playing when it lands.
    const incoming = trackRef.current?.querySelector<HTMLVideoElement>(`article[data-offset="${dir}"] video`);
    if (incoming) {
      incoming.muted = mutedRef.current;
      incoming.play().catch(() => { /* the autoplay effect retries (muted) once it lands */ });
    }
    // transitionend can go missing (hidden tab, interrupted animation): never get stuck mid-slide.
    landTimer.current = setTimeout(() => land(dir), 600);
  }, [n, land]);

  useEffect(() => () => clearTimeout(landTimer.current), []);

  const onTrackTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget || e.propertyName !== "transform" || shift === 0) return;
    land(shift === -1 ? 1 : -1);
  };

  // Measure the frame so the sprockets can move by exactly one frame per slide.
  const hasFrame = !!items && n > 0;
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFrameH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasFrame]);

  const activeVideo = () => trackRef.current?.querySelector<HTMLVideoElement>("article[data-active] video") ?? null;

  // Autoplay whenever a trailer becomes current: on entering the feed, after each slide and
  // after a filter change. With sound if the browser allows it, otherwise muted.
  const curId = items?.[i]?.id;
  useEffect(() => {
    setProgress(0);
    setPaused(false); // no ▶ flash while the video starts
    if (!curId) return;
    const v = activeVideo();
    if (!v) return; // placeholder art: just the "playing" look
    v.muted = mutedRef.current;
    v.play().catch(() => {
      if (v.muted) return setPaused(true);
      v.muted = mutedRef.current = true;
      setMuted(true);
      v.play().catch(() => setPaused(true));
    });
  }, [curId]);

  const unmute = useCallback(() => {
    mutedRef.current = false;
    setMuted(false);
    const v = activeVideo();
    if (v) {
      v.muted = false;
      if (v.paused) v.play().catch(() => setPaused(true));
    }
  }, []);

  // Plays/pauses the current slide's video when there is one; otherwise just the visual state.
  const togglePlay = useCallback(() => {
    const v = activeVideo();
    if (!v) return setPaused((p) => !p);
    if (v.paused) v.play().catch(() => setPaused(true));
    else v.pause();
  }, []);

  // ↑/↓ switch trailers, Space plays/pauses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, button, a")) return;
      if (e.key === "ArrowDown") { e.preventDefault(); go(1); }
      if (e.key === "ArrowUp") { e.preventDefault(); go(-1); }
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, togglePlay]);

  if (failed) return <Message title="Не удалось загрузить ленту" />;
  if (!items) return <main className="h-[calc(100dvh-56px-var(--tabbar-h))] md:h-[calc(100dvh-88px-var(--tabbar-h))]" aria-busy="true" />;
  if (n === 0) {
    return time || genres.length ? (
      <Message title="Под эти фильтры ничего нет" link={{ href: feedHref({ kind, reel }), label: "Сбросить время и жанры" }} />
    ) : (
      <Message
        title={kind === "series" ? "Здесь пока нет микро-сериалов" : "Здесь пока нет короткометражек"}
        link={{ href: feedHref({ kind: kind === "series" ? "film" : "series", reel }), label: kind === "series" ? "Смотреть короткометражки" : "Смотреть микро-сериалы" }}
      />
    );
  }

  const patch = (id: string, p: Partial<Trailer>) =>
    // Lists are per title, so update every trailer of that title.
    setItems((list) => list && list.map((t) => (t.title.id === id ? { ...t, ...p } : t)));

  const actionsFor = (t: Trailer): Action[] => [
    { name: "Комментарии", on: false, d: icons.comments, fn: () => toast("Комментарии появятся в следующей версии") },
    {
      name: t.in_watchlist ? "В списке «Хочу посмотреть»" : "Хочу посмотреть", on: t.in_watchlist, d: icons.save,
      fn: () => { closeHints(); saveToggle("watchlist", t.title.id, !t.in_watchlist, (v) => patch(t.title.id, { in_watchlist: v })); },
    },
    { name: "Поделиться", on: false, d: icons.share, fn: () => toast("Поделиться можно будет в следующей версии") },
  ];

  // Swipe: the track follows the finger; past SWIPE_PX it slides on, otherwise it snaps back.
  const onTouchStart = (e: React.TouchEvent) => {
    if (busy.current) return;
    touchY.current = e.touches[0].clientY;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchY.current === null) return;
    setDrag(n < 2 ? 0 : e.touches[0].clientY - touchY.current);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchY.current;
    touchY.current = null;
    setDragging(false);
    if (dy < -SWIPE_PX) go(1);
    else if (dy > SWIPE_PX) go(-1);
    else setDrag(0);
  };
  const LONG_PRESS_MS = 500;
  const onPressStart = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    clearTimeout(press.current?.timer);
    const p = { x: e.clientX, y: e.clientY, fired: false } as NonNullable<typeof press.current>;
    p.timer = setTimeout(() => {
      p.fired = true;
      setBare((b) => !b);
    }, LONG_PRESS_MS);
    press.current = p;
  };
  const onPressMove = (e: React.PointerEvent) => {
    const p = press.current;
    // Moving turns the gesture into a swipe, not a press.
    if (p && !p.fired && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) clearTimeout(p.timer);
  };
  const onPressEnd = () => clearTimeout(press.current?.timer);
  // The click that ends a long press must not also play/pause or press a button.
  const onPressClick = (e: React.MouseEvent) => {
    if (press.current?.fired) {
      e.preventDefault();
      e.stopPropagation();
      press.current = null;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    // Trackpads send long bursts of wheel events: one slide per burst.
    if (Math.abs(e.deltaY) < 30 || Date.now() - lastWheel.current < 700) return;
    lastWheel.current = Date.now();
    go(e.deltaY > 0 ? 1 : -1);
  };

  // Slides on the track: previous (−1), current (0), next (+1). Keys follow the trailer, so the
  // frame that slides in keeps its DOM (and loaded video) when it becomes current.
  const cur = items[i];
  const wide = !!(cur.video_url && cur.video_landscape);
  const slides: { t: Trailer; offset: -1 | 0 | 1; key: string }[] = [{ t: cur, offset: 0, key: cur.id }];
  if (n > 1) {
    const next = items[(i + 1) % n];
    const prev = items[(i - 1 + n) % n];
    slides.push({ t: next, offset: 1, key: next.id });
    slides.push({ t: prev, offset: -1, key: prev.id === next.id ? `prev-${prev.id}` : prev.id });
  }

  const arrow = (dir: "up" | "down", onClick: () => void, label: string) => (
    <button type="button" onClick={onClick} aria-label={label} className="grid size-12 place-items-center rounded-full bg-surface text-ink transition-colors hover:bg-surface-hover">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === "up" ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
      </svg>
    </button>
  );

  return (
    // Fills the space between the header and the bottom tab band.
    <main
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onWheel={onWheel}
      onPointerDown={onPressStart}
      onPointerMove={onPressMove}
      onPointerUp={onPressEnd}
      onPointerCancel={onPressEnd}
      onClickCapture={onPressClick}
      // A long press on a video would open the browser's «save video» menu.
      onContextMenu={(e) => e.preventDefault()}
      // Phone turned sideways (or a long press): the feed covers the whole screen, header and tab band stay underneath.
      className={`flex h-[calc(100dvh-56px-var(--tabbar-h))] touch-none justify-center gap-6 overflow-hidden select-none md:h-[calc(100dvh-88px-var(--tabbar-h))] landscape-phone:fixed landscape-phone:inset-0 landscape-phone:z-50 landscape-phone:h-auto! landscape-phone:gap-0 landscape-phone:bg-ground ${
        wide ? "landscape:gap-0" : ""
      } ${bare ? "fixed inset-0 z-50 h-auto! gap-0! bg-ground" : ""}`}
    >
      {/* Desktop: keeps the card centered against the arrows column */}
      <div aria-hidden className={`hidden w-12 md:block landscape-phone:hidden! ${wide ? "landscape:hidden!" : ""} ${bare ? "hidden!" : ""}`} />

      {/* Vertical 9:16 card; on a wide screen a horizontal video turns the player wide (16:9, as large
          as fits). A phone turned sideways gets the whole screen either way. */}
      <section
        aria-label="Лента"
        className={`relative aspect-[9/16] h-full max-w-full overflow-hidden bg-surface md:rounded-strip ${
          wide ? "landscape:aspect-auto! landscape:h-full! landscape:w-full! landscape:max-w-none landscape:rounded-none!" : ""
        } landscape-phone:aspect-auto! landscape-phone:h-full! landscape-phone:w-full! landscape-phone:self-stretch! landscape-phone:rounded-none!`}
      >
        {/* Side perforation moves with the frames (same transform timing as the track) */}
        {(["left-1.5", "right-1.5"] as const).map((side) => (
          <div
            key={side}
            aria-hidden
            className={`absolute ${side} flex flex-col gap-3 will-change-transform ${wide ? "landscape:hidden" : ""}`}
            style={{
              top: -(frameH + GAP + PITCH * 2),
              transform: `translateY(${sprocketBase + shift * (frameH + GAP) + drag}px)`,
              transition: instant || dragging ? "none" : SLIDE,
            }}
          >
            {Array.from({ length: Math.ceil((frameH * 3 + GAP * 3) / PITCH) + 8 }, (_, k) => (
              <span key={k} className="h-3 w-2.5 flex-none rounded-[2px] bg-ground" />
            ))}
          </div>
        ))}

        {/* Wide video on a wide screen: the frame goes edge to edge, no film strip around it */}
        <div ref={frameRef} className={`absolute inset-x-5 inset-y-2 ${wide ? "landscape:inset-0" : ""}`}>
          <div
            ref={trackRef}
            onTransitionEnd={onTrackTransitionEnd}
            className="absolute inset-0 will-change-transform"
            style={{
              transform: `translateY(calc(${shift * 100}% + ${shift * GAP + drag}px))`,
              transition: instant || dragging ? "none" : SLIDE,
            }}
          >
            {slides.map(({ t, offset, key }) => (
              <Slide
                key={key}
                fill={wide && !!t.video_landscape}
                t={t}
                offset={offset}
                active={offset === 0}
                paused={paused}
                progress={progress}
                actions={actionsFor(t)}
                hints={hints}
                backHref={reel ? feedHref({ kind }) : null}
                fit={fitSentence(t.title, time)}
                bare={bare}
                onToggle={togglePlay}
                onCloseHints={closeHints}
                onWatch={() => toast(t.title.kind === "series" ? "Полные серии появятся в следующей версии" : "Полный фильм появится в следующей версии")}
                onPlayState={setPaused}
                onProgress={setProgress}
                muted={muted}
                onUnmute={unmute}
                onEnded={() => go(1)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Desktop: prev/next arrows beside the card */}
      <div className={`hidden w-12 flex-col justify-center gap-2.5 md:flex landscape-phone:hidden! ${wide ? "landscape:hidden!" : ""} ${bare ? "hidden!" : ""}`}>
        {arrow("up", () => go(-1), "Предыдущий трейлер")}
        {arrow("down", () => go(1), "Следующий трейлер")}
      </div>

      {rotateHint && <RotateHint onClose={() => setRotateHint(false)} />}
    </main>
  );
}

type SlideProps = {
  t: Trailer;
  fill: boolean; // horizontal video in the wide player: covers the frame edge to edge on wide screens
  offset: -1 | 0 | 1;
  active: boolean;
  paused: boolean;
  progress: number;
  actions: Action[];
  hints: boolean;
  backHref: string | null;
  onToggle: () => void;
  onCloseHints: () => void;
  onWatch: () => void;
  onPlayState: (paused: boolean) => void;
  onProgress: (p: number) => void;
  fit: string | null; // series + «Время» set: «Успеете 6 серий из 20»
  bare: boolean; // long press: hide every overlay, only the picture stays
  muted: boolean; // autoplay fell back to muted: show «Включить звук»
  onUnmute: () => void;
  onEnded: () => void; // a trailer that plays to the end moves the feed on
};

/** One frame on the track. Only the active one is interactive; neighbours are visible while sliding. */
function Slide({ t, fill, offset, active, paused, progress, actions, hints, backHref, fit, bare, onToggle, onCloseHints, onWatch, onPlayState, onProgress, muted, onUnmute, onEnded }: SlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0); // seconds, read from the video file

  // A frame that slides away stops and rewinds, so it starts over when you come back.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.readyState >= 1) setDuration(v.duration);
    if (!active) {
      v.pause();
      if (v.currentTime > 0.1) v.currentTime = 0.1;
    }
  }, [active]);

  // Neighbours never show ▶: they slide in already playing (or as art), so the move looks seamless.
  const isPaused = active && paused;
  // The card shows how long the film / series is (what the «Время» filter uses), not the trailer.
  const meta = [trailerKindLabel[t.kind], t.title.runtime || t.length || formatDuration(duration), t.title.genre].filter(Boolean).join(" · ");

  return (
    <article
      data-active={active || undefined}
      data-offset={offset}
      aria-hidden={!active}
      inert={!active}
      aria-labelledby={active ? "film" : undefined}
      className="absolute inset-0"
      style={{ transform: `translateY(calc(${offset * 100}% + ${offset * GAP}px))` }}
    >
      {/* A real video sits on plain black; the abstract art is only for trailers without one */}
      <Art art={t.video_url ? { bg: "#000", ink: t.art.ink, shape: "" } : t.art} className={`size-full rounded-frame ${fill ? "landscape:rounded-none" : ""}`}>
        {t.video_url && (
          // #t=0.1 makes browsers draw the first frame instead of a black box before play.
          <video
            ref={videoRef}
            src={`${t.video_url}#t=0.1`}
            // The real poster covers the frame until the first picture arrives (some trailers open on black).
            poster={t.title.poster ?? undefined}
            playsInline
            // Only three videos exist at once (previous, current, next): load them fully for an instant start.
            preload="auto"
            // contain: the whole picture is always visible; on a vertical screen a horizontal trailer
            // sits on black, and the wide player / sideways phone lets it fill the frame.
            className={`absolute inset-0 size-full object-contain ${fill ? "landscape:object-cover" : ""}`}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onPlay={active ? () => onPlayState(false) : undefined}
            onPause={active ? () => onPlayState(true) : undefined}
            onTimeUpdate={active ? (e) => {
              const v = e.currentTarget;
              if (v.duration) onProgress(v.currentTime / v.duration);
            } : undefined}
            onEnded={active ? onEnded : undefined}
          />
        )}
        {/* Tapping the frame plays/pauses */}
        <button type="button" onClick={onToggle} aria-label={isPaused ? "Смотреть" : "Пауза"} className="absolute inset-0 cursor-pointer" />
        {/* Everything over the picture; a long press hides it all (bare) and brings it back */}
        <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${bare ? "invisible opacity-0" : ""}`}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-ground via-ground/70 to-ground/0" />

        {isPaused && (
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ground/45 text-white backdrop-blur-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
          </span>
        )}

        {backHref && (
          <Link href={backHref} className="pointer-events-auto absolute top-3 left-3 rounded-btn bg-ground/60 px-3 py-1.5 text-sm font-semibold text-ink no-underline backdrop-blur-sm">
            ← Все трейлеры
          </Link>
        )}

        {/* Autoplay started without sound (browser rule before the first tap): one tap turns it on */}
        {active && muted && t.video_url && (
          <button
            type="button"
            onClick={onUnmute}
            className="pointer-events-auto absolute top-3 right-3 flex h-9 items-center gap-2 rounded-full bg-ground/70 pr-3.5 pl-3 text-sm font-semibold text-ink backdrop-blur-sm transition-colors hover:bg-accent hover:text-on-accent"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9h4l5-4v14l-5-4H4zM17 9l4 6M21 9l-4 6" />
            </svg>
            Включить звук
          </button>
        )}

        {/* Actions on the right edge, vertically centered */}
        <div className="pointer-events-auto absolute top-1/2 right-2 flex -translate-y-1/2 flex-col items-center gap-2">
          {actions.map((a) => (
            <div key={a.d} className="relative">
              {active && hints && a.d === icons.save && (
                <span className="absolute top-1/2 right-full mr-2 w-max max-w-[180px] -translate-y-1/2 rounded-btn bg-ground/80 px-3 py-2 text-[13px] leading-snug text-ink-soft backdrop-blur-sm">
                  Сохраняйте фильм в «Хочу посмотреть»
                </span>
              )}
              <button
                type="button"
                onClick={a.fn}
                aria-pressed={a.on}
                aria-label={a.name}
                title={a.name}
                className={`grid size-11 place-items-center rounded-full transition-colors hover:bg-ground/40 ${a.on ? "text-accent" : "text-white"}`}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill={a.on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="drop-shadow-[0_1px_3px_rgba(0,0,0,.6)]">
                  <path d={a.d} />
                </svg>
              </button>
            </div>
          ))}
          {active && hints && (
            <button type="button" onClick={onCloseHints} aria-label="Скрыть подсказки" className="mt-1 grid size-8 place-items-center rounded-full bg-ground/60 text-muted hover:text-ink">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          )}
        </div>

        {/* Title block at the bottom of the frame */}
        <div className="pointer-events-none absolute inset-x-4 bottom-6 flex flex-col gap-1.5 pr-12">
          {fit && (
            <p className="flex items-center gap-1.5 self-start rounded-full bg-accent px-3 py-1 text-[13px] font-bold text-on-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
              </svg>
              {fit}
            </p>
          )}
          <p className="text-sm font-semibold text-accent">{meta}</p>
          <div className="flex items-center gap-2.5">
            {/* The title opens its page */}
            <h1 id={active ? "film" : undefined} className="text-[26px] leading-tight font-extrabold text-ink md:text-[28px] landscape-phone:text-xl!">
              <Link href={titleHref(t.title)} className="pointer-events-auto text-ink no-underline hover:text-accent-hover">
                {t.title.title}
              </Link>
            </h1>
            {t.title.age_rating && (
              <span aria-label={`Возрастное ограничение ${t.title.age_rating}`} className="flex-none rounded-[4px] border border-ink/50 px-1.5 py-0.5 text-xs leading-none font-bold text-ink">
                {t.title.age_rating}
              </span>
            )}
          </div>
          <p className="line-clamp-2 max-w-[60ch] text-[15px] leading-snug text-ink-soft landscape-phone:line-clamp-1">{t.note}</p>
          {/* Where the trailer was taken from; the credits inside the video name the authors */}
          {t.source_url && (
            <a
              href={t.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto self-start text-[13px] text-muted no-underline hover:text-ink"
            >
              {t.kind === "trailer" ? "Официальный трейлер" : t.kind === "teaser" ? "Официальный тизер" : "Официальное видео"} · Источник:{" "}
              <span className="whitespace-nowrap">{t.source_label || "ссылка"} ↗</span>
            </a>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onWatch}
            className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-btn border-2 border-ink/60 px-4 text-[15px] font-bold text-ink transition-colors hover:border-accent hover:bg-accent hover:text-on-accent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
            {t.title.kind === "series" ? "Смотреть первую серию" : "Смотреть целиком"}
          </button>
          {/* The title page («как на Кинопоиске») */}
          <Link
            href={titleHref(t.title)}
            className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-btn bg-ground/60 px-4 text-[15px] font-bold text-ink no-underline backdrop-blur-sm transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
            </svg>
            {t.title.kind === "series" ? "О сериале" : "О фильме"}
          </Link>
          </div>
        </div>

        {/* Progress: real for the playing video, a fixed mark for placeholder art */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
          <span className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${t.video_url ? (active ? progress : 0) * 100 : 30}%` }} />
        </span>
        </div>
      </Art>
    </article>
  );
}

/** 95.4 → "1:35"; 0 or unknown → "". */
function formatDuration(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return "";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Message({ title, link = { href: "/trailers", label: "Все трейлеры" } }: { title: string; link?: { href: string; label: string } }) {
  return (
    <main className="mx-auto max-w-page px-gutter pt-16">
      <h1 className="text-h2 font-bold">{title}</h1>
      <Link href={link.href} className="mt-4 inline-block font-semibold">{link.label}</Link>
    </main>
  );
}
