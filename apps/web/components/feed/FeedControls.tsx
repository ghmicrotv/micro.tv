"use client";
// Header filters on «Кинотеатр» and «Лента»: Короткометражки / Микро-сериалы and one «Фильтры» panel
// with «Время» and genres.
// They write to the URL; each page reads the same params (lib/feedParams.ts).
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { filtersHref, readFeedParams, type FeedParams } from "@/lib/feedParams";

const TIME_PRESETS = [5, 15, 30];

/** Pages that show the filters in the header. */
export const FILTER_PAGES = ["/", "/trailers"];

export function FeedControls() {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  if (!FILTER_PAGES.includes(path)) return null;

  const f = readFeedParams(params);
  const active = (f.time ? 1 : 0) + f.genres.length; // number of filters set
  // Changing a filter starts the feed from the top, so drop the start title.
  const apply = (p: Partial<FeedParams>) =>
    router.replace(filtersHref(path, { ...f, title: undefined, ...p }), { scroll: false });

  return (
    <div className="flex items-center gap-1 md:gap-2">
      <div role="group" aria-label="Что смотреть" className="flex rounded-full bg-surface p-1">
        {([["film", "Короткометражки", "Фильмы"], ["series", "Микро-сериалы", "Сериалы"]] as const).map(([kind, full, short]) => (
          <button
            key={kind}
            type="button"
            aria-pressed={f.kind === kind}
            onClick={() => f.kind !== kind && apply({ kind })}
            className={`h-8 rounded-full px-2 text-[13px] font-semibold transition-colors md:h-9 md:px-4 md:text-sm ${
              f.kind === kind ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
            }`}
          >
            <span className="md:hidden">{short}</span>
            <span className="hidden md:inline">{full}</span>
          </button>
        ))}
      </div>

      {/* One «Фильтры» panel: free time and genres. Choices apply at once; «Готово» closes it. */}
      <Popover
        label={
          active > 0
            ? `Фильтры: ${[f.time ? `до ${f.time} мин` : "", f.genres.join(", ")].filter(Boolean).join(", ")}`
            : "Фильтры"
        }
        active={active > 0}
        button={
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" />
            </svg>
            {/* Phones: the lilac button alone shows filters are on, to leave room for the logo */}
            {active > 0 && <span className="hidden text-sm font-semibold md:inline">{active}</span>}
          </>
        }
      >
        {(close) => (
          <div className="flex flex-col gap-5">
            <TimePanel value={f.time} onPick={(time) => apply({ time })} />
            <div className="border-t border-line" />
            <GenrePanel value={f.genres} onChange={(genres) => apply({ genres })} />
            <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
              {active > 0 ? (
                <button type="button" onClick={() => apply({ time: null, genres: [] })} className="text-sm font-semibold text-accent hover:text-accent-hover">
                  Сбросить всё
                </button>
              ) : <span />}
              <button type="button" onClick={close} className="h-10 rounded-btn bg-accent px-5 font-bold text-on-accent transition-colors hover:bg-accent-hover">
                Готово
              </button>
            </div>
          </div>
        )}
      </Popover>
    </div>
  );
}

/** Round header button with a panel under it; closes on outside click or Escape. */
function Popover({ label, active, button, children }: {
  label: string; active: boolean; button: ReactNode; children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 min-w-9 items-center justify-center gap-1 rounded-full px-2 transition-colors md:h-11 md:min-w-11 md:px-2.5 ${
          active ? "bg-accent text-on-accent" : "bg-surface text-ink hover:bg-surface-hover"
        }`}
      >
        {button}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 max-h-[calc(100dvh-var(--tabbar-h)-80px)] w-[min(320px,calc(100vw-32px))] overflow-y-auto rounded-strip border border-line bg-ground p-4 shadow-[0_16px_48px_rgba(0,0,0,.6)]">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const chip = (on: boolean) =>
  `h-9 rounded-full px-3.5 text-sm font-semibold transition-colors ${on ? "bg-accent text-on-accent" : "bg-surface text-ink hover:bg-surface-hover"}`;

function TimePanel({ value, onPick }: { value: number | null; onPick: (min: number | null) => void }) {
  const [custom, setCustom] = useState(value && !TIME_PRESETS.includes(value) ? String(value) : "");
  const customMin = Number(custom);
  const customOk = Number.isInteger(customMin) && customMin >= 1 && customMin <= 600;

  return (
    <div className="flex flex-col gap-3">
      <p className="font-bold">Сколько у вас времени?</p>
      <div className="flex flex-wrap gap-2">
        {TIME_PRESETS.map((m) => (
          <button key={m} type="button" aria-pressed={value === m} onClick={() => onPick(m)} className={chip(value === m)}>
            {m} мин
          </button>
        ))}
        <button type="button" aria-pressed={value === null} onClick={() => onPick(null)} className={chip(value === null)}>
          Любое
        </button>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (customOk) onPick(customMin); }}
        className="flex items-center gap-2"
      >
        <label className="flex h-10 flex-1 items-center gap-2 rounded-btn bg-surface px-3 focus-within:outline-2 focus-within:outline-accent">
          <span className="sr-only">Своё время в минутах</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            placeholder="Своё время"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-muted"
          />
          <span className="text-sm text-muted">мин</span>
        </label>
        <button type="submit" disabled={!customOk} className="h-10 rounded-btn bg-accent px-4 font-bold text-on-accent disabled:opacity-40">
          OK
        </button>
      </form>
      <p className="text-[13px] text-muted">Для сериалов считаем длину одной серии.</p>
    </div>
  );
}

function GenrePanel({ value, onChange }: { value: string[]; onChange: (g: string[]) => void }) {
  // The same four genres for films and series (GET /genres).
  const [genres, setGenres] = useState<string[] | null>(null);
  useEffect(() => {
    api.genres().then(({ items }) => setGenres(items), () => setGenres([]));
  }, []);

  const toggle = (g: string) => onChange(value.includes(g) ? value.filter((x) => x !== g) : [...value, g]);

  return (
    <div className="flex flex-col gap-3">
      <p className="font-bold">Жанры</p>
      <div className="flex flex-wrap gap-2">
        {genres === null && <span className="text-sm text-muted">Загружаем…</span>}
        {genres?.map((g) => (
          <button key={g} type="button" aria-pressed={value.includes(g)} onClick={() => toggle(g)} className={chip(value.includes(g))}>
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}
