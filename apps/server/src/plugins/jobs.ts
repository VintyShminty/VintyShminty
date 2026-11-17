import fp from "fastify-plugin";
import { runInBackground } from "../lib/background.js";
import { endFinishedBuzzes } from "../lib/bumps.js";
import { cleanupFeedData, refreshPopularity } from "../lib/feed-jobs.js";
import { runOrderJobs } from "../lib/order-jobs.js";

const POPULARITY_EVERY_MS = 15 * 60 * 1000;
const CLEANUP_CHECK_EVERY_MS = 60 * 60 * 1000;
/** The nightly cleanup runs in this hour (UTC), once a day. */
const CLEANUP_HOUR_UTC = 3;
/** Without timers (Vercel): the time-sensitive chores run after a request, at most this often per server copy. */
const CATCH_UP_EVERY_MS = 5 * 60 * 1000;

/**
 * Runs the background jobs on timers: the offer and order jobs, "popular this week" every 15 minutes and the nightly
 * feed cleanup. The tests switch the timers off (JOBS_INTERVAL_SECONDS=0) and call the functions. On a host without
 * a long running server, a scheduler calls the same jobs through `/v1/jobs/...` (routes/jobs.ts). That scheduler may
 * only run once a day, so there the chores that cannot wait (held items, offers, unpaid orders, ended buzzes, popular
 * this week) also run after a visitor's request, see `catchUpAfterRequests`.
 */
export default fp(
  async (app) => {
    const seconds = app.env.JOBS_INTERVAL_SECONDS;
    if (seconds <= 0) return;
    // Off on Vercel (IN_PROCESS_JOBS): the cron in vercel.json calls /v1/jobs/all once a day, visitors do the rest.
    if (!app.env.IN_PROCESS_JOBS) {
      catchUpAfterRequests(app);
      return;
    }
    const timers: NodeJS.Timeout[] = [];

    let running = false;
    timers.push(
      setInterval(() => {
        if (running) return;
        running = true;
        runOrderJobs(app)
          .then((result) => {
            if (Object.values(result).some((n) => n > 0)) app.log.info({ result }, "order jobs ran");
          })
          .catch((err) => app.log.error({ err }, "order jobs failed"))
          .finally(() => {
            running = false;
          });
      }, seconds * 1000),
    );

    let counting = false;
    const countPopularity = () => {
      if (counting) return;
      counting = true;
      refreshPopularity(app)
        .catch((err) => app.log.error({ err }, "popularity re-count failed"))
        .finally(() => {
          counting = false;
        });
    };
    timers.push(setInterval(countPopularity, POPULARITY_EVERY_MS));
    timers.push(setTimeout(countPopularity, 5000));

    let lastCleanupDay = "";
    timers.push(
      setInterval(() => {
        const now = new Date();
        const day = now.toISOString().slice(0, 10);
        if (now.getUTCHours() !== CLEANUP_HOUR_UTC || day === lastCleanupDay) return;
        lastCleanupDay = day;
        cleanupFeedData(app, now)
          .then((result) => app.log.info({ result }, "feed cleanup ran"))
          .catch((err) => app.log.error({ err }, "feed cleanup failed"));
      }, CLEANUP_CHECK_EVERY_MS),
    );

    // Buzzes that ran out: checked every hour, so "Buzzing" never stays long past its end.
    let endingBuzz = false;
    timers.push(
      setInterval(() => {
        if (endingBuzz) return;
        endingBuzz = true;
        endFinishedBuzzes(app)
          .then((result) => {
            if (result.buzzesEnded > 0) app.log.info({ result }, "buzzes ended");
          })
          .catch((err) => app.log.error({ err }, "ending buzzes failed"))
          .finally(() => {
            endingBuzz = false;
          });
      }, CLEANUP_CHECK_EVERY_MS),
    );

    for (const timer of timers) timer.unref();
    app.addHook("onClose", async () => {
      for (const timer of timers) {
        clearInterval(timer);
        clearTimeout(timer);
      }
    });
  },
  { name: "jobs", dependencies: ["db"] },
);

/**
 * The stand-in for timers on a host that only lives while it answers. After a response has gone, and at most once
 * every five minutes per server copy, the chores that cannot wait a day run in the background. All of them are safe
 * to run twice, so several copies doing this at once is fine. Nobody visiting means nobody is waiting either.
 */
function catchUpAfterRequests(
  app: Parameters<typeof runOrderJobs>[0] & Parameters<typeof refreshPopularity>[0],
) {
  let lastRun = 0;
  let lastPopularity = 0;
  let running = false;
  app.addHook("onResponse", async (request) => {
    if (running || request.url.startsWith("/v1/jobs") || request.url.startsWith("/health")) return;
    const now = Date.now();
    if (now - lastRun < CATCH_UP_EVERY_MS) return;
    lastRun = now;
    running = true;
    const popularityDue = now - lastPopularity >= POPULARITY_EVERY_MS;
    if (popularityDue) lastPopularity = now;
    runInBackground(
      (async () => {
        try {
          const orders = await runOrderJobs(app);
          const buzz = await endFinishedBuzzes(app);
          if (popularityDue) await refreshPopularity(app);
          if (Object.values(orders).some((n) => n > 0) || buzz.buzzesEnded > 0) {
            app.log.info({ orders, buzz }, "catch-up jobs ran");
          }
        } catch (err) {
          app.log.error({ err }, "catch-up jobs failed");
        } finally {
          running = false;
        }
      })(),
    );
  });
}
