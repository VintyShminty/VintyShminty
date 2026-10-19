"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CAPTCHA_HEADER,
  EMPTY_HELP_ANSWER,
  HELP_QUESTION_MAX,
  helpAnswerSchema,
  photoAssistStatusSchema,
} from "@vinty/shared";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { clientApi } from "@/lib/api-client";
import { getCaptchaToken } from "@/lib/captcha";

export type HelpAskLabels = {
  title: string;
  placeholder: string;
  button: string;
  thinking: string;
  label: string;
  readMore: string;
  noAnswer: string;
};

/**
 * "Ask a question" at the top of the Help page (D-043). Shown only when the AI status says help answers are on.
 * The wording and article titles come from the server page as props, so the browser does not need the help wording.
 */
export function HelpAsk({
  lang,
  labels,
  titles,
}: {
  lang: "en" | "he";
  labels: HelpAskLabels;
  /** Article id to its title. */
  titles: Record<string, string>;
}) {
  const [text, setText] = useState("");
  const status = useQuery({
    queryKey: ["photo-assist"],
    queryFn: () => clientApi("/v1/sell/assist", { schema: photoAssistStatusSchema }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const ask = useMutation({
    mutationFn: async (question: string) => {
      const token = await getCaptchaToken();
      return clientApi("/v1/help/ask", {
        method: "POST",
        body: { question, language: lang },
        lang,
        schema: helpAnswerSchema,
        ...(token ? { headers: { [CAPTCHA_HEADER]: token } } : {}),
      });
    },
  });

  if (!status.data?.helpAssist) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const question = text.trim();
    if (question.length < 3 || ask.isPending) return;
    ask.mutate(question);
  };

  const result = ask.isError ? EMPTY_HELP_ANSWER : ask.data;

  return (
    <section className="mt-xl flex flex-col gap-md">
      <h2 className="text-body font-bold text-text-1">{labels.title}</h2>
      <form onSubmit={submit} className="flex flex-col gap-sm sm:flex-row">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={HELP_QUESTION_MAX}
          placeholder={labels.placeholder}
          aria-label={labels.title}
          className="h-11 min-w-0 flex-1 rounded-control border border-border bg-background px-lg text-body-sm text-text-1 outline-none placeholder:text-text-3 focus:border-primary"
        />
        <button
          type="submit"
          disabled={ask.isPending || text.trim().length < 3}
          className="inline-flex h-11 items-center justify-center rounded-control bg-primary px-lg text-body-sm font-semibold text-on-accent hover:opacity-90 disabled:opacity-50"
        >
          {labels.button}
        </button>
      </form>

      {ask.isPending ? (
        <p role="status" className="flex items-center gap-xs text-body-sm text-text-3">
          <Sparkles size={14} aria-hidden className="shrink-0" />
          {labels.thinking}
        </p>
      ) : result?.answered && result.answer ? (
        <div className="flex flex-col gap-sm rounded-control bg-surface p-lg">
          <p className="whitespace-pre-line text-body-sm text-text-1">{result.answer}</p>
          <p className="flex items-center gap-xs text-small-label text-text-3">
            <Sparkles size={14} aria-hidden className="shrink-0" />
            {labels.label}
          </p>
          {result.articleIds.map((id) => (
            <Link
              key={id}
              href={`/${lang}/help/${id}`}
              className="text-body-sm font-semibold text-primary hover:underline"
            >
              {labels.readMore}: {titles[id] ?? id}
            </Link>
          ))}
        </div>
      ) : result ? (
        <p className="text-body-sm text-text-3">
          <a href="#still-stuck" className="hover:text-primary hover:underline">
            {labels.noAnswer}
          </a>
        </p>
      ) : null}
    </section>
  );
}
