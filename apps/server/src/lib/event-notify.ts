import { users } from "@vinty/db";
import { formatMoney, type Locale, type NotificationType } from "@vinty/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { type NotifyInput, notifyUser } from "./notify.js";

type App = FastifyInstance;
type Copy = { title: string; body: string };

/** A person's name as push titles show it. */
export async function displayNameFor(app: Pick<App, "db">, userId: string): Promise<string> {
  const [row] = await app.db
    .select({ displayUsername: users.displayUsername, username: users.username, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.displayUsername ?? row?.username ?? row?.name ?? "Vinty";
}

const text = (data: Record<string, unknown>, key: string) => {
  const value = data[key];
  return typeof value === "string" ? value : "";
};
const money = (data: Record<string, unknown>, key: string, locale: Locale) => {
  const value = data[key];
  return typeof value === "number" ? formatMoney(value, text(data, "currency") || "ILS", locale) : "";
};

/**
 * The sentence of a push for the order, offer and review types, in the person's language. The app writes its own
 * sentences for the Notifications tab from `type` and `data`. Null means this type sends no push.
 */
export function pushCopy(
  type: NotificationType,
  data: Record<string, unknown>,
  locale: Locale,
  actorName: string,
): Copy | null {
  const he = locale === "he";
  const title = text(data, "title");
  const amount = money(data, "amountMinor", locale);
  switch (type) {
    case "new_offer":
      return {
        title: actorName,
        body: he ? `הציע/ה ${amount} עבור ${title}` : `Offered ${amount} for ${title}`,
      };
    case "offer_accepted":
      return {
        title: actorName,
        body: he
          ? `אישר/ה את ההצעה שלך של ${amount} עבור ${title}. אפשר להשלים את הרכישה`
          : `Accepted your offer of ${amount} for ${title}. You can check out now`,
      };
    case "offer_declined":
      return {
        title: actorName,
        body: he ? `דחה/תה את ההצעה שלך עבור ${title}` : `Declined your offer for ${title}`,
      };
    case "offer_countered":
      return {
        title: actorName,
        body: he ? `הציע/ה ${amount} עבור ${title}` : `Countered with ${amount} for ${title}`,
      };
    case "offer_expired":
      return {
        title: "Vinty",
        body: he ? `ההצעה עבור ${title} פגה` : `The offer for ${title} has expired`,
      };
    case "order_paid":
      return {
        title: he ? "מישהו קנה ממך" : "Someone bought from you",
        body: he ? `${title} מחכה למשלוח` : `${title} is waiting to be shipped`,
      };
    case "order_shipped":
      return { title: "Vinty", body: he ? `${title} יצא לדרך` : `${title} is on the way to you` };
    case "order_delivered":
      return {
        title: "Vinty",
        body: he ? `${title} הגיע. אשרו שהוא אצלכם` : `${title} has arrived. Tap to say it reached you`,
      };
    case "order_completed":
      return {
        title: "Vinty",
        body:
          text(data, "role") === "buyer"
            ? he
              ? `הכול סגור. ספרו איך היה`
              : `All wrapped up. Tell us how it went`
            : he
              ? `${title} נמכר והכסף ביתרה שלכם`
              : `${title} is sold and the money is in your balance`,
      };
    case "balance_released":
      return {
        title: "Vinty",
        body: he ? `${amount} זמינים עכשיו ביתרה שלך` : `${amount} is now available in your balance`,
      };
    case "order_cancelled":
      return {
        title: "Vinty",
        body: he ? `ההזמנה עבור ${title} בוטלה` : `The order for ${title} was cancelled`,
      };
    case "review_received": {
      const rating = Number(data.rating ?? 0);
      return {
        title: actorName,
        body: he ? `השאיר/ה לך ${rating} כוכבים` : `Left you ${rating} ${rating === 1 ? "star" : "stars"}`,
      };
    }
    case "review_reminder":
      return {
        title: "Vinty",
        body: he ? `איך היה? אפשר להשאיר משוב על ${title}` : `How did it go? Leave feedback for ${title}`,
      };
    case "favourite_sold":
      return {
        title: "Vinty",
        body: he ? `פריט שאהבת נמכר: ${title}` : `An item you liked was sold: ${title}`,
      };
    case "bump_ended":
      return {
        title: "Vinty",
        body: he ? `הבאז על ${title} הסתיים` : `The buzz on ${title} has ended`,
      };
    default:
      return null;
  }
}

/** `notifyUser` with the push sentence filled in for the order, offer and review types. */
export async function notifyEvent(
  app: App,
  input: Omit<NotifyInput, "push"> & { actorName?: string },
): Promise<void> {
  const { actorName, ...rest } = input;
  const name = actorName ?? (input.actorId ? await displayNameFor(app, input.actorId) : "Vinty");
  await notifyUser(app, {
    ...rest,
    push: (locale) => pushCopy(input.type, input.data ?? {}, locale, name),
    pushData: { ...(input.actorId ? { userId: input.actorId } : {}), ...(input.pushData ?? {}) },
  });
}
