"use client";
import { useCallback } from "react";
import { api, ApiError, type ListName } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/**
 * Optimistic add/remove for «Хочу посмотреть».
 * `apply` flips local state immediately and is called again with the old value on failure.
 */
export function useSaveToggle() {
  const toast = useToast();
  return useCallback(
    async (list: ListName, titleId: string, next: boolean, apply: (v: boolean) => void) => {
      apply(next);
      try {
        await api.setInList(list, titleId, next);
      } catch (e) {
        apply(!next);
        toast(e instanceof ApiError && e.status === 401 ? "Войдите в профиле, чтобы сохранять" : "Не удалось сохранить");
      }
    },
    [toast],
  );
}
