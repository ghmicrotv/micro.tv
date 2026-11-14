"use client";
// «Поверните телефон»: shown over the short-film feed on a phone held upright (film trailers are
// horizontal). A tap anywhere closes it; turning the phone closes it too (see app/trailers/page.tsx).

export function RotateHint({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Поверните телефон, чтобы смотреть на весь экран. Нажмите, чтобы закрыть подсказку"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-ground/95 px-8 text-center text-ink backdrop-blur-md"
    >
      <span aria-hidden className="relative grid size-44 place-items-center">
        {/* Curved arrow around the phone */}
        <svg width="176" height="176" viewBox="0 0 176 176" fill="none" className="absolute inset-0 text-accent">
          <path d="M40 40 A68 68 0 0 1 136 40" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 10" />
          <path d="M126 26 L138 42 L120 46" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* The phone turns on its side and back */}
        <svg width="64" height="112" viewBox="0 0 64 112" fill="none" className="rotate-phone">
          <rect x="3" y="3" width="58" height="106" rx="12" stroke="currentColor" strokeWidth="5" />
          <rect x="10" y="14" width="44" height="80" rx="4" className="fill-accent/30" />
          <path d="M27 103h10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M26 46 L40 54 L26 62 Z" className="fill-accent" />
        </svg>
      </span>
      <span className="block text-2xl font-extrabold">Поверните телефон</span>
      <span className="block max-w-[30ch] text-[17px] text-ink-soft">
        Трейлеры фильмов горизонтальные — на боку они займут весь экран
      </span>
      <span className="mt-4 block text-sm text-muted">Нажмите в любом месте, чтобы продолжить</span>
    </button>
  );
}
