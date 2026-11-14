import Link from "next/link";
import type { TitleCard } from "@/lib/api";
import { titleHref } from "@/lib/feedParams";
import { Art } from "./Art";

type Props = {
  title: TitleCard;
  width?: string;
  textSize?: string;
  badge?: string | null; // e.g. «6 из 20 серий» under the «Время» filter
};

// A poster opens the title page (/films/… or /series/…).
// A real poster replaces the abstract art (it carries its own title lettering).
export function PosterCard({ title, width = "w-[136px] md:w-[200px] flex-none snap-start", textSize = "text-base md:text-xl", badge }: Props) {
  return (
    <Link href={titleHref(title)} className={`group block text-ink no-underline ${width}`}>
      <Art
        art={title.art}
        className="aspect-[2/3] rounded-frame transition-transform duration-300 ease-film group-hover:scale-[1.04]"
      >
        {title.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={title.poster} alt={title.title} loading="lazy" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className={`absolute inset-x-3.5 font-extrabold leading-none ${badge ? "bottom-10" : "bottom-3.5"} ${textSize}`}>{title.title}</span>
        )}
        {badge && (
          <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-full bg-accent px-2 py-1 text-[11px] leading-none font-bold text-on-accent md:text-xs">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
            </svg>
            {badge}
          </span>
        )}
        {title.age_rating && (
          <span className="absolute top-2 right-2 rounded-[4px] bg-ground/75 px-1.5 py-0.5 text-[11px] leading-none font-bold text-ink">
            {title.age_rating}
          </span>
        )}
      </Art>
    </Link>
  );
}
