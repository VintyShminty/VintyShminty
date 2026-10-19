import { queryOptions } from "@tanstack/react-query";
import { CAPTCHA_HEADER, EMPTY_HELP_ANSWER, type HelpAnswer, helpAnswerSchema } from "@vinty/shared";
import { api } from "@/lib/api";
import { getCaptchaToken } from "@/lib/captcha";

/**
 * One answer per question and language, kept while the person reads articles and comes back. Never refetched by
 * itself. A failure is the same as "no answer" for the page, so no retries.
 */
export const helpAskQuery = (question: string, language: "en" | "he") =>
  queryOptions({
    queryKey: ["help-ask", language, question],
    queryFn: async () => {
      const token = await getCaptchaToken();
      return api<HelpAnswer>("/v1/help/ask", {
        method: "POST",
        body: { question, language },
        schema: helpAnswerSchema,
        ...(token ? { headers: { [CAPTCHA_HEADER]: token } } : {}),
      }).catch((): HelpAnswer => EMPTY_HELP_ANSWER);
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
