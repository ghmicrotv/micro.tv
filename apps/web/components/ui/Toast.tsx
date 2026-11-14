"use client";
// One-line notices for stub actions («скоро») and save errors.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

const ToastContext = createContext<(msg: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    // Longer notices (the disclaimer) stay up long enough to read.
    timer.current = setTimeout(() => setMsg(null), Math.max(2600, m.length * 50));
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+16px)] z-50">
        {msg && (
          <div key={msg} className="toast-in absolute bottom-0 left-1/2 w-max max-w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-btn bg-surface-hover px-5 py-3 font-semibold text-ink shadow-lg">
            {msg}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
