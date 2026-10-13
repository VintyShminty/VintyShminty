/**
 * The Help Centre is bundled in the app (docs/blueprint/api.md, `/v1/help/topics` stays unbuilt on purpose).
 * This file only says which articles exist and how they are grouped. The words live in the locale files under
 * `help.groups.<group>` and `help.articles.<id>` (title and body, paragraphs split by a blank line).
 */
export const HELP_GROUPS = [
  { id: "buying", articles: ["buyAnItem", "makeAnOffer", "covered", "closetDeal", "saveItems"] },
  { id: "selling", articles: ["listAnItem", "setYourPrice", "buzz", "getPaid", "awayMode"] },
  { id: "orders", articles: ["orderSteps", "shipAnOrder", "receivedOrProblem", "cancelAnOrder"] },
  { id: "account", articles: ["profileAndSizes", "signInAndFaceId", "inviteFriends", "closeAccount"] },
  { id: "safety", articles: ["stayInside", "reportAndBlock"] },
] as const;

export const HELP_ARTICLE_IDS: string[] = HELP_GROUPS.flatMap((g) => [...g.articles]);

/** Where "Still stuck?" writes to. */
export const SUPPORT_EMAIL = "vintyshminty@gmail.com";
