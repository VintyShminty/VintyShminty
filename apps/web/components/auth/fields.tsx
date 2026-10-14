"use client";

import { Eye, EyeOff } from "lucide-react";
import { type InputHTMLAttributes, type ReactNode, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** The page frame of the account pages: a centered column with a title and a line under it. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[440px] px-lg pb-2xl pt-xl md:pt-2xl">
      <h1 className="text-title text-text-1">{title}</h1>
      {subtitle ? (
        <p className="mb-xl mt-sm text-subtitle text-text-3">{subtitle}</p>
      ) : (
        <div className="mb-xl" />
      )}
      {children}
    </main>
  );
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** A translation key already turned into words. */
  error?: string;
  hint?: string;
  /** Adds the show and hide button, for passwords. */
  reveal?: boolean;
};

/** A labelled text field with its hint and error underneath. The error is announced to screen readers. */
export function Field({ label, value, onChange, error, hint, reveal, className, type, ...rest }: FieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const [shown, setShown] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-xs block text-body-sm font-semibold text-text-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          {...rest}
          type={reveal && shown ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-12 w-full rounded-control border bg-background px-md text-body text-text-1 outline-none placeholder:text-text-4 focus:border-primary",
            error ? "border-error" : "border-border",
            reveal && "pe-[48px]",
            className,
          )}
        />
        {reveal ? (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? t("fields.hidePassword") : t("fields.showPassword")}
            aria-pressed={shown}
            className="absolute inset-y-0 end-0 inline-flex w-12 items-center justify-center text-text-3 hover:text-text-1"
          >
            {shown ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-xs text-body-sm text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-xs text-body-sm text-text-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A message above the form. Errors are announced at once, the others politely. */
export function Notice({ kind, children }: { kind: "error" | "success" | "info"; children: ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "mb-lg rounded-control px-md py-md text-body-sm",
        kind === "error" && "bg-error-tint text-error",
        kind === "success" && "bg-success-tint text-success",
        kind === "info" && "bg-accent-tint text-text-1",
      )}
    >
      {children}
    </p>
  );
}

/** The big espresso button of a form. Shows a spinner word instead of the label while it works. */
export function SubmitButton({
  children,
  busy,
  className,
  disabled,
}: {
  children: ReactNode;
  busy?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      aria-busy={busy}
      className={cn(
        "inline-flex h-12 w-full items-center justify-center rounded-control bg-primary px-lg text-body font-semibold text-on-accent hover:opacity-90 disabled:opacity-60",
        className,
      )}
    >
      {busy ? (
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-on-accent border-t-transparent"
          aria-hidden
        />
      ) : (
        children
      )}
    </button>
  );
}

/** A quiet text button in the link colour. */
export function TextButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn("text-body-sm font-bold", disabled ? "text-text-4" : "text-primary hover:underline")}
    >
      {children}
    </button>
  );
}

/** Counts down from `from` seconds, once a second. `restart()` begins again. */
export function useCountdown(from: number) {
  const [left, setLeft] = useState(from);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return { left, restart: () => setLeft(from) };
}
