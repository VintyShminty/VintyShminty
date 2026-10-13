import fp from "fastify-plugin";
import { cleanupFeedData, refreshPopularity } from "../lib/feed-jobs.js";
import { runOrderJobs } from "../lib/order-jobs.js";

const POPULARITY_EVERY_MS = 15 * 60 * 1000;
const CLEANUP_CHECK_EVERY_MS = 60 * 60 * 1000;
/** The nightly cleanup runs in this hour (UTC), once a day. */
const CLEANUP_HOUR_UTC = 3;

/**
 * Runs the background jobs on timers: the offer and order jobs, "popular this week" every 15 minutes and the nightly
 * feed cleanup. The tests switch the timers off (JOBS_INTERVAL_SECONDS=0) and call the functions. On a host without
 * a long running server, a scheduler calls the same jobs through `/v1/jobs/...` (routes/jobs.ts).
 */
export default fp(
  async (app) => {
    const seconds = app.env.JOBS_INTERVAL_SECONDS;
    // Off on Vercel (IN_PROCESS_JOBS): the crons in vercel.json call /v1/jobs/... instead.
    if (seconds <= 0 || !app.env.IN_PROCESS_JOBS) return;
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
