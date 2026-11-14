"use client";
// «Профиль»: user header, «Продолжить просмотр» (design only), «Списки»: «Хочу посмотреть» (live) and «Просмотренные» (static demo list), «Настройки» (design only).
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type ListName, type TitleCard, type User } from "@/lib/api";
import { titleHref } from "@/lib/feedParams";
import { Art } from "@/components/film/Art";
import { Sprockets } from "@/components/film/FilmStrip";
import { PosterCard } from "@/components/film/PosterCard";
import { Avatar } from "@/components/profile/Avatar";
import { EditProfileDialog } from "@/components/profile/EditProfileDialog";
import { FEEDBACK_URL } from "@/components/SupportBlock";

// Watch history is not in the prototype: static data from the design.
const history = [
  { slug: "khroniki-pustoshi", kind: "series" as const, t: "Хроники Пустоши", when: "Вчера", bg: "#8E3FD9", s: "width:120%;aspect-ratio:1;border-radius:50%;background:#2A0F4A;right:-50%;top:28%" },
  { slug: "leto-na-oke", kind: "film" as const, t: "Лето на Оке", when: "28 октября", bg: "#FFB45E", s: "width:64%;aspect-ratio:1;border-radius:50%;background:#FF6A3D;right:-12%;top:10%" },
  { slug: "poslednii-seans", kind: "film" as const, t: "Последний сеанс", when: "27 октября", bg: "#2A0F2E", s: "left:0;right:0;top:44%;height:16%;background:#FF4FB8" },
  { slug: "severnyi-veter", kind: "film" as const, t: "Северный ветер", when: "25 октября", bg: "#1B2A6B", s: "width:110%;aspect-ratio:1;border-radius:50%;background:#C9B8FF;left:-30%;top:8%" },
  { slug: "ogni-porta", kind: "film" as const, t: "Огни порта", when: "24 октября", bg: "#0E1C3A", s: "left:0;right:0;top:58%;height:4%;background:#FFC94A" },
  { slug: "kod-molchaniya", kind: "series" as const, t: "Код молчания", when: "20 октября", bg: "#12323A", s: "width:38%;aspect-ratio:1;background:#1FA88F;left:31%;top:20%" },
  { slug: "steklyannyi-gorod", kind: "film" as const, t: "Стеклянный город", when: "18 октября", bg: "#3B2BFF", s: "width:46%;height:120%;left:30%;top:-30%;background:rgba(255,255,255,.2);transform:rotate(18deg)" },
];

const tabs: { list: ListName; name: string }[] = [
  { list: "watchlist", name: "Хочу посмотреть" },
  { list: "watched", name: "Просмотренные" },
];

const settings = [
  { name: "Автозапуск", hint: "Следующий трейлер начнётся сам" },
  { name: "Звук сразу", hint: "Иначе лента стартует без звука" },
  { name: "Премьеры", hint: "Напомним в день выхода" },
];

export default function ProfilePage() {
  // undefined = loading, null = signed out
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    api.me().then(setUser, (e) => (e instanceof ApiError && e.status === 401 ? setUser(null) : setFailed(true)));
  }, []);
  useEffect(load, [load]);

  if (failed) return <main className="mx-auto max-w-page px-gutter pt-16 text-h3 font-bold">Не удалось загрузить профиль</main>;
  if (user === undefined) return <main className="min-h-screen" aria-busy="true" />;
  if (user === null) return <SignedOut onSignIn={() => api.demoLogin().then(setUser, () => setFailed(true))} />;
  return <Profile user={user} onUser={setUser} onSignOut={() => api.logout().then(() => setUser(null))} />;
}

function Profile({ user, onUser, onSignOut }: { user: User; onUser: (u: User) => void; onSignOut: () => void }) {
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<TitleCard[] | null>(null);
  const [opts, setOpts] = useState([true, false, true]);

  useEffect(() => {
    setItems(null);
    api.list(tabs[tab].list).then(({ items }) => setItems(items), () => setItems([]));
  }, [tab]);

  return (
    <main className="pb-section">
      <section aria-labelledby="me" className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-5 px-gutter pt-4 md:gap-8 md:pt-8">
        <div className="flex min-w-0 items-center gap-4 md:gap-7">
          <Avatar user={user} />
          <div className="min-w-0">
            <h1 id="me" className="text-h1 font-extrabold break-words">{user.display_name}</h1>
            <p className="mt-1 text-[15px] text-muted md:mt-2 md:text-base">@{user.handle} · 48 трейлеров за осень</p>
          </div>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="h-12 w-full rounded-btn bg-surface px-6 font-semibold transition-colors hover:bg-surface-hover md:h-[52px] md:w-auto">
          Редактировать профиль
        </button>
      </section>

      {/* Feedback request */}
      <section aria-labelledby="feedback" className="mx-auto mt-8 max-w-page px-gutter md:mt-12">
        <div className="flex flex-col gap-4 rounded-strip border border-accent/40 bg-surface p-5 md:flex-row md:items-center md:justify-between md:gap-8 md:p-6">
          <div>
            <h2 id="feedback" className="text-xl font-bold md:text-2xl">Помогите нам стать лучше</h2>
            <p className="mt-1 max-w-[60ch] text-[15px] text-ink-soft">
              Это тестовая версия Micro.tv. Расскажите, что понравилось, чего не хватает и что сломалось — это займёт пару минут.
            </p>
          </div>
          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 flex-none items-center justify-center gap-2 rounded-btn bg-accent px-6 font-bold text-on-accent no-underline transition-colors hover:bg-accent-hover hover:text-on-accent"
          >
            Оставить отзыв ↗
          </a>
        </div>
      </section>

      <section aria-labelledby="hist" className="mt-12 md:mt-[72px]">
        <h2 id="hist" className="mx-auto max-w-page px-gutter text-h3 font-bold">Продолжить просмотр</h2>
        <div className="mt-4 bg-surface py-3 md:mt-6">
          <Sprockets />
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-gutter py-3">
            {history.map((f) => (
              <Link key={f.slug} href={titleHref(f)} className="group w-[120px] flex-none text-ink no-underline md:w-[170px]">
                <Art art={{ bg: f.bg, ink: "", shape: f.s }} className="aspect-[9/16] rounded-frame transition-transform duration-300 ease-film group-hover:scale-[1.04]" />
                <p className="mt-2.5 text-sm leading-tight font-semibold md:text-base md:leading-normal">{f.t}</p>
                <p className="text-sm text-muted">{f.when}</p>
              </Link>
            ))}
          </div>
          <Sprockets />
        </div>
      </section>

      <div className="mx-auto mt-12 flex max-w-page flex-wrap gap-12 px-gutter md:mt-[72px] md:gap-16">
        <section aria-labelledby="lists" className="min-w-0 flex-[999_1_560px]">
          <div className="flex flex-wrap items-baseline gap-x-7 gap-y-1">
            <h2 id="lists" className="text-h3 font-bold">Списки</h2>
            <div role="tablist" aria-label="Списки" className="flex gap-5">
              {tabs.map((t, k) => (
                <button
                  key={t.list}
                  role="tab"
                  type="button"
                  aria-selected={k === tab}
                  onClick={() => setTab(k)}
                  className={`h-11 border-b-2 font-semibold transition-colors ${
                    k === tab ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div role="tabpanel" className="mt-5 grid grid-cols-3 gap-3 md:mt-6 md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:gap-5">
            {items?.map((t) => <PosterCard key={t.id} title={t} width="" textSize="text-sm md:text-[17px]" />)}
            {items?.length === 0 && (
              <p className="col-span-full text-muted">
                {tabs[tab].list === "watched" ? (
                  "Здесь появятся фильмы и сериалы, которые вы посмотрели."
                ) : (
                  <>Пока пусто. Добавляйте фильмы в <Link href="/trailers">ленте трейлеров</Link>.</>
                )}
              </p>
            )}
          </div>
        </section>

        <aside aria-labelledby="set" className="min-w-0 flex-[1_1_320px]">
          <h2 id="set" className="text-h3 font-bold">Настройки</h2>
          {settings.map((o, k) => (
            <div key={o.name} className="flex items-center justify-between gap-4 border-b border-line py-[18px]">
              <span>
                <span className="block font-semibold">{o.name}</span>
                <span className="text-[15px] text-muted">{o.hint}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={opts[k]}
                aria-label={o.name}
                onClick={() => setOpts((v) => v.map((x, j) => (j === k ? !x : x)))}
                className={`relative h-[30px] w-[54px] flex-none rounded-switch transition-colors ${opts[k] ? "bg-accent" : "bg-surface-hover"}`}
              >
                <span className={`absolute top-1 size-[22px] rounded transition-[left] ${opts[k] ? "left-7 bg-on-accent" : "left-1 bg-muted"}`} />
              </button>
            </div>
          ))}
          <button type="button" onClick={onSignOut} className="mt-4 h-11 font-semibold text-danger">
            Выйти из аккаунта
          </button>
        </aside>
      </div>

      <EditProfileDialog user={user} open={editing} onClose={() => setEditing(false)} onSaved={onUser} />
    </main>
  );
}

function SignedOut({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="mx-auto flex max-w-page flex-col items-start gap-6 px-gutter pt-8 md:pt-16">
      <h1 className="text-h1 font-extrabold">Вы вышли из аккаунта</h1>
      <p className="max-w-[44ch] text-lg text-ink-soft md:text-xl">
        Войдите, чтобы сохранять фильмы в «Хочу посмотреть».
      </p>
      <button type="button" onClick={onSignIn} className="h-14 rounded-btn bg-accent px-7 font-bold text-on-accent transition-colors hover:bg-accent-hover">
        Войти как демо
      </button>
    </main>
  );
}
