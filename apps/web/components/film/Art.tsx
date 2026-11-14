// Abstract placeholder art (posters and 9:16 "video" frames) from the design.
import type { CSSProperties, ReactNode } from "react";
import type { Art as ArtData } from "@/lib/api";

/** Turns the design's inline CSS ("left:0;top:44%;background:#FF4FB8") into a React style object. */
export function cssToStyle(css: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    style[prop] = decl.slice(i + 1).trim();
  }
  return style;
}

type Props = {
  art: ArtData;
  shape?: string; // overrides art.shape (e.g. a 9:16 variant)
  className?: string;
  children?: ReactNode;
};

export function Art({ art, shape, className = "", children }: Props) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: art.bg, color: art.ink }}>
      <div aria-hidden className="absolute" style={cssToStyle(shape ?? art.shape)} />
      {children}
    </div>
  );
}
