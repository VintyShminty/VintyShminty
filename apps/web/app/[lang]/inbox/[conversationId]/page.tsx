import { notFound } from "next/navigation";
import { ChatView } from "@/components/inbox/chat-view";
import { isLang } from "@/lib/i18n";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One open chat. Everything in it loads in the browser, because it is personal and live. */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ lang: string; conversationId: string }>;
}) {
  const { lang, conversationId } = await params;
  if (!isLang(lang) || !UUID.test(conversationId)) notFound();
  return <ChatView key={conversationId} lang={lang} id={conversationId} />;
}
