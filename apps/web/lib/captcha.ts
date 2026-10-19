"use client";

/**
 * The bot check in the browser (Cloudflare Turnstile, see packages/shared/src/captcha.ts). One hidden widget for the
 * whole site. Each protected call asks it for a fresh one time answer. Usually nobody sees anything. When Cloudflare is
 * unsure it shows a small checkbox at the bottom of the screen until the person ticks it.
 * Off when NEXT_PUBLIC_TURNSTILE_SITE_KEY is empty: the calls then go out without an answer.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined;
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** Give up after this long and send the call without an answer (the server then decides). */
const TIMEOUT_MS = 30_000;

type RenderOptions = {
  sitekey: string;
  execution: "execute";
  appearance: "interaction-only";
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
};
type Turnstile = {
  render(container: HTMLElement, options: RenderOptions): string;
  execute(container: HTMLElement | string): void;
  reset(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let scriptLoading: Promise<Turnstile> | undefined;
let widget: { id: string; container: HTMLElement } | undefined;
let waiting: ((token: string | undefined) => void) | undefined;
let queue: Promise<unknown> = Promise.resolve();

function loadScript(): Promise<Turnstile> {
  scriptLoading ??= new Promise<Turnstile>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("no turnstile")));
    script.onerror = () => {
      scriptLoading = undefined;
      reject(new Error("turnstile did not load"));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

function finish(token: string | undefined) {
  const done = waiting;
  waiting = undefined;
  done?.(token);
}

async function ensureWidget(turnstile: Turnstile, siteKey: string) {
  if (widget) return widget;
  const container = document.createElement("div");
  // Bottom centre, above everything, only visible when Cloudflare asks for a tick.
  container.style.cssText =
    "position:fixed;bottom:16px;inset-inline:0;margin-inline:auto;width:fit-content;z-index:2147483647";
  document.body.appendChild(container);
  const id = turnstile.render(container, {
    sitekey: siteKey,
    execution: "execute",
    appearance: "interaction-only",
    callback: (token) => finish(token),
    "error-callback": () => finish(undefined),
    "expired-callback": () => finish(undefined),
  });
  widget = { id, container };
  return widget;
}

async function freshToken(siteKey: string): Promise<string | undefined> {
  try {
    const turnstile = await loadScript();
    const { id, container } = await ensureWidget(turnstile, siteKey);
    return await new Promise<string | undefined>((resolve) => {
      const timer = window.setTimeout(() => finish(undefined), TIMEOUT_MS);
      waiting = (token) => {
        window.clearTimeout(timer);
        resolve(token);
      };
      // Every answer works once, so start over each time.
      turnstile.reset(id);
      turnstile.execute(container);
    });
  } catch {
    return undefined;
  }
}

/** A fresh one time answer for the next protected call, or undefined when the check is off or failed. */
export function getCaptchaToken(): Promise<string | undefined> {
  if (!SITE_KEY) return Promise.resolve(undefined);
  const siteKey = SITE_KEY;
  // One at a time: the widget gives one answer per run.
  const next = queue.then(() => freshToken(siteKey));
  queue = next.catch(() => undefined);
  return next;
}
