"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Toast = { id: number; kind: "success" | "error"; message: string };
type Show = (message: string, kind?: Toast["kind"]) => void;

const ToastContext = createContext<Show>(() => {});

/** `const toast = useToast()`, then `toast("Saved")` or `toast("Could not save", "error")`. */
export const useToast = () => useContext(ToastContext);

/** A small pop-up at the bottom for every change an admin makes. Errors stay a little longer. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const all = timers.current;
    return () => {
      for (const timer of all) clearTimeout(timer);
    };
  }, []);

  const show = useCallback<Show>((message, kind = "success") => {
    const id = next.current++;
    setToasts((list) => [...list.slice(-2), { id, kind, message }]);
    const timer = setTimeout(
      () => {
        timers.current.delete(timer);
        setToasts((list) => list.filter((toast) => toast.id !== id));
      },
      kind === "error" ? 6000 : 3000,
    );
    timers.current.add(timer);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-lg z-[200] flex flex-col items-center gap-sm px-lg"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={cn(
              "flex max-w-md items-center gap-sm rounded-bar border px-lg py-sm text-body-sm font-semibold shadow-lg",
              toast.kind === "error"
                ? "border-error bg-error-tint text-error"
                : "border-border bg-background text-text-1",
            )}
          >
            {toast.kind === "error" ? (
              <XCircle size={16} aria-hidden className="shrink-0" />
            ) : (
              <CheckCircle2 size={16} aria-hidden className="shrink-0 text-success" />
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
