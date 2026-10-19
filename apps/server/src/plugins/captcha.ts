import { CAPTCHA_FAILED_CODE, CAPTCHA_HEADER, needsCaptcha } from "@vinty/shared";
import fp from "fastify-plugin";
import type { CaptchaChecker } from "../lib/captcha.js";
import { ApiError } from "../lib/errors.js";

const MESSAGE = "We could not check that you are a person";

/** Runs the bot check (lib/captcha.ts) before sign up, log in, code requests and Help questions. */
export default fp<{ checker: CaptchaChecker }>(
  async (app, { checker }) => {
    if (!checker.enabled) return;
    app.addHook("preHandler", async (request, reply) => {
      if (request.method !== "POST" || !needsCaptcha(request.url)) return;
      const header = request.headers[CAPTCHA_HEADER];
      const token = (Array.isArray(header) ? header[0] : header)?.trim() || undefined;
      if ((await checker.check(token, request.ip, request.log)) === "pass") return;
      // Log in calls answer in Better Auth's shape, so the forms show the right words (describeAuthError).
      if (request.url.startsWith("/api/auth/")) {
        return reply.code(403).send({ code: CAPTCHA_FAILED_CODE, message: MESSAGE });
      }
      throw ApiError.forbidden(MESSAGE);
    });
  },
  { name: "captcha" },
);
