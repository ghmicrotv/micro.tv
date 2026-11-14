"use client";
// «Редактировать профиль»: display name, @handle and avatar upload.
import { useEffect, useRef, useState } from "react";
import { api, ApiError, type User } from "@/lib/api";
import { Avatar } from "./Avatar";

type Props = { user: User; open: boolean; onClose: () => void; onSaved: (u: User) => void };

export function EditProfileDialog({ user, open, onClose, onSaved }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(user.display_name);
  const [handle, setHandle] = useState(user.handle);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync the native <dialog> with `open` and reset the form each time it opens.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setName(user.display_name);
      setHandle(user.handle);
      setFile(null);
      setError(null);
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, user]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let u = await api.updateMe(name, handle);
      if (file) u = await api.uploadAvatar(file);
      onSaved(u);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  const field = "mt-2 h-12 w-full rounded-btn border-0 bg-surface px-4 text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="edit-title"
      className="m-auto w-[min(480px,calc(100vw-32px))] rounded-strip bg-ground p-0 text-ink backdrop:bg-ground/80"
    >
      <form onSubmit={save} className="flex flex-col gap-5 border border-line p-5 md:p-8">
        <h2 id="edit-title" className="text-h3 font-bold">Профиль</h2>

        <div className="flex items-center gap-5">
          <Avatar user={{ ...user, display_name: name || user.display_name, avatar_url: preview ?? user.avatar_url }} size="small" />
          <label className="inline-flex h-11 cursor-pointer items-center rounded-btn bg-surface px-5 font-semibold transition-colors hover:bg-surface-hover focus-within:outline-2 focus-within:outline-accent">
            Загрузить фото
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <p className="-mt-3 text-[15px] text-muted">PNG, JPG, WebP или GIF, до 2 МБ</p>

        <label className="block font-semibold">
          Имя
          <input className={field} value={name} maxLength={40} required onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block font-semibold">
          Ник
          <span className="relative block">
            <span className="pointer-events-none absolute top-1/2 left-4 mt-1 -translate-y-1/2 text-muted">@</span>
            <input className={`${field} pl-9`} value={handle} maxLength={24} required onChange={(e) => setHandle(e.target.value)} />
          </span>
        </label>

        {error && <p role="alert" className="text-danger">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-12 rounded-btn bg-surface px-6 font-semibold transition-colors hover:bg-surface-hover">
            Отмена
          </button>
          <button type="submit" disabled={saving} className="h-12 rounded-btn bg-accent px-6 font-bold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60">
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
