// Film-strip motifs: perforation rows and the horizontal strip used for rails.
import type { ReactNode } from "react";

/** Horizontal perforation row. Decorative. */
export function Sprockets({ count = 56 }: { count?: number }) {
  return (
    <div aria-hidden className="flex gap-4 overflow-hidden px-2">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-[13px] w-[18px] flex-none rounded-[3px] bg-ground" />
      ))}
    </div>
  );
}

/** Vertical perforation column, positioned by the parent. */
export function SprocketsV({ count, hole, gap, className }: { count: number; hole: string; gap: string; className: string }) {
  return (
    <div aria-hidden className={`absolute top-0 bottom-0 flex flex-col ${className}`} style={{ gap }}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`flex-none bg-ground ${hole}`} />
      ))}
    </div>
  );
}

export function FilmStrip({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface py-3">
      <Sprockets />
      <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-gutter py-3">{children}</div>
      <Sprockets />
    </div>
  );
}
