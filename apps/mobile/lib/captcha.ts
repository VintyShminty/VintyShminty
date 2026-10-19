/**
 * The bot check in the app (Cloudflare Turnstile, see packages/shared/src/captcha.ts). Cloudflare's check only runs in
 * a web page, so components/captcha-host.tsx keeps the website's /app-check page open in a hidden web view, and this
 * file asks it for a fresh one time answer before each protected call.
 * Off when EXPO_PUBLIC_WEB_URL is empty: the calls then go out without an answer.
 */

/** Give up after this long and send the call without an answer (the server then decides). */
const TIMEOUT_MS = 30_000;
/** How long a call waits for the hidden page to finish loading before it goes without an answer. */
const READY_WAIT_MS = 5_000;

type HostStatus = "absent" | "loading" | "ready" | "failed";

let status: HostStatus = "absent";
let runCheck: (() => void) | undefined;
let waiting: ((token: string | undefined) => void) | undefined;
let readyWaiters: (() => void)[] = [];
let queue: Promise<unknown> = Promise.resolve();

/** For the host: the page is loading, ready (with the way to start a check) or failed. */
export function setCaptchaHost(next: HostStatus, run?: () => void) {
  status = next;
  runCheck = run;
  if (next !== "loading") {
    for (const wake of readyWaiters) wake();
    readyWaiters = [];
  }
  if (next === "failed" || next === "absent") finishCaptcha(undefined);
}

/** For the host: the page sent an answer, or undefined when the check failed. */
export function finishCaptcha(token: string | undefined) {
  const done = waiting;
  waiting = undefined;
  done?.(token);
}

function waitForReady(): Promise<void> {
  if (status !== "loading") return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, READY_WAIT_MS);
    readyWaiters.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function freshToken(): Promise<string | undefined> {
  await waitForReady();
  const run = runCheck;
  if (status !== "ready" || !run) return undefined;
  return new Promise<string | undefined>((resolve) => {
    const timer = setTimeout(() => finishCaptcha(undefined), TIMEOUT_MS);
    waiting = (token) => {
      clearTimeout(timer);
      resolve(token);
    };
    run();
  });
}

/** A fresh one time answer for the next protected call, or undefined when the check is off or failed. */
export function getCaptchaToken(): Promise<string | undefined> {
  // One at a time: the page gives one answer per run.
  const next = queue.then(freshToken);
  queue = next.catch(() => undefined);
  return next;
}
