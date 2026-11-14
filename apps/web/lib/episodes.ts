// «Сколько у вас времени» for micro-series: how many episodes fit into the chosen minutes.
// Films are filtered by time on the server; series always show with this count instead.
import { plural, type TitleCard } from "@/lib/api";

const EP: [string, string, string] = ["серию", "серии", "серий"];
const EP_NOM: [string, string, string] = ["серия", "серии", "серий"];

/** Episodes that fit into `minutes`, or null when it doesn't apply (no time set, a film, unknown length). */
export function episodesThatFit(t: Pick<TitleCard, "kind" | "episodes" | "episode_seconds">, minutes: number | null) {
  if (!minutes || t.kind !== "series" || !t.episodes || !t.episode_seconds) return null;
  return Math.min(t.episodes, Math.floor((minutes * 60) / t.episode_seconds));
}

/** Feed card: «Успеете 6 серий из 20», «Успеете все 6 серий», «Не успеете ни одной серии». */
export function fitSentence(t: Pick<TitleCard, "kind" | "episodes" | "episode_seconds">, minutes: number | null) {
  const n = episodesThatFit(t, minutes);
  if (n === null) return null;
  if (n === 0) return "Не успеете ни одной серии";
  if (n === t.episodes) return `Успеете все ${n} ${plural(n, EP)}`;
  return `Успеете ${n} ${plural(n, EP)} из ${t.episodes}`;
}

/** Poster badge: «6 из 20 серий», «все 6 серий», «0 серий». */
export function fitBadge(t: Pick<TitleCard, "kind" | "episodes" | "episode_seconds">, minutes: number | null) {
  const n = episodesThatFit(t, minutes);
  if (n === null) return null;
  if (n === t.episodes) return `все ${n} ${plural(n, EP_NOM)}`;
  return `${n} из ${t.episodes} ${plural(t.episodes, ["серии", "серий", "серий"])}`;
}
