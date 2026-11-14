"use client";
// Series page: /series/{slug}.
import { useParams } from "next/navigation";
import { TitleView } from "@/components/title/TitleView";

export default function SeriesPage() {
  const { slug } = useParams<{ slug: string }>();
  return <TitleView slug={slug} />;
}
