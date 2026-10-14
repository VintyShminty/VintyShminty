"use client";

import { signInInputSchema } from "@vinty/shared";
import { createAuthClient } from "better-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { io, type Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type Chat = "idle" | "connected" | "failed";

/** Logs in through the website's own address, then opens the live chat connection straight to the server. */
export function ConnectionCheck() {
  // The website's own address is only known in the browser, so the check starts after the page has loaded.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  return origin ? <Check origin={origin} /> : null;
}

function Check({ origin }: { origin: string }) {
  const { t } = useTranslation();
  // The website's own address, so the login cookie belongs to the website.
  const authClient = useMemo(() => createAuthClient({ baseURL: origin, basePath: "/api/auth" }), [origin]);
  const { data: session, isPending } = authClient.useSession();
  const token = session?.session.token;
  const [chat, setChat] = useState<Chat>("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setChat("idle");
      return;
    }
    const socket: Socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket"] });
    socket.on("connect", () => setChat("connected"));
    socket.on("disconnect", () => setChat("idle"));
    socket.on("connect_error", (err) => {
      setReason(err.message);
      setChat("failed");
    });
    return () => {
      socket.disconnect();
    };
  }, [token]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = signInInputSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "");
      return;
    }
    setBusy(true);
    setError("");
    const { error: failure } = await authClient.signIn.email(parsed.data);
    if (failure) setError(failure.message ?? "");
    setBusy(false);
  }

  const field = "h-11 w-full rounded-control border border-border bg-background px-md text-body text-text-1";
  const button = "h-11 rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent";

  return (
    <main className="mx-auto max-w-[420px] px-lg py-xl">
      <h1 className="text-title text-text-1">{t("web.dev.title")}</h1>
      <p className="mt-sm text-body text-text-3">{t("web.dev.intro")}</p>

      {isPending ? (
        <p className="mt-xl text-body text-text-3">{t("web.dev.loading")}</p>
      ) : session ? (
        <div className="mt-xl flex flex-col gap-md">
          <p className="text-body text-text-1">{t("web.dev.signedInAs", { name: session.user.email })}</p>
          <p
            className={chat === "connected" ? "text-body text-success" : "text-body text-text-3"}
            role="status"
          >
            {chat === "connected" ? t("web.dev.chatConnected") : t("web.dev.chatNotConnected")}
          </p>
          {chat === "failed" ? (
            <p className="text-body-sm text-error">{t("web.dev.chatFailed", { reason })}</p>
          ) : null}
          <button type="button" className={button} onClick={() => void authClient.signOut()}>
            {t("web.dev.logOut")}
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-xl flex flex-col gap-md">
          <p className="text-body text-text-3">{t("web.dev.signedOut")}</p>
          <label className="flex flex-col gap-xs text-body-sm text-text-2">
            {t("web.dev.email")}
            <input name="email" type="email" autoComplete="email" className={field} />
          </label>
          <label className="flex flex-col gap-xs text-body-sm text-text-2">
            {t("web.dev.password")}
            <input name="password" type="password" autoComplete="current-password" className={field} />
          </label>
          {error ? <p className="text-body-sm text-error">{error}</p> : null}
          <button type="submit" disabled={busy} className={button}>
            {t("web.dev.logIn")}
          </button>
        </form>
      )}
    </main>
  );
}
