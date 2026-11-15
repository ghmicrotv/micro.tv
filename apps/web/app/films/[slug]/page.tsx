"use client";
export const runtime = 'edge';
// Film page: /films/{slug}.
import { useParams } from "next/navigation";
import { TitleView } from "@/components/title/TitleView";

export default function FilmPage() {
  const { slug } = useParams<{ slug: string }>();
  return <TitleView slug={slug} />;
}
