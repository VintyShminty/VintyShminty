import fp from "fastify-plugin";
import { runOrderJobs } from "../lib/order-jobs.js";

/** Runs the offer and order background jobs on a timer. The tests switch the timer off and call `runOrderJobs`. */
export default fp(
  async (app) => {
    const seconds = app.env.JOBS_INTERVAL_SECONDS;
    if (seconds <= 0) return;
    let running = false;
    const timer = setInterval(() => {
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
    }, seconds * 1000);
    timer.unref();
    app.addHook("onClose", async () => clearInterval(timer));
  },
  { name: "jobs", dependencies: ["db"] },
);
