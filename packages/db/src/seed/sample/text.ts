import type { Rng } from "./rng.js";

export const descIntroHe = [
  "במצב מצוין, לבשתי כמה פעמים בלבד.",
  "קניתי ולא התאים לי בסוף.",
  "פינוי ארון, הכל במצב טוב.",
  "אהבתי מאוד אבל כבר לא משתמשת.",
  "קנוי בחנות, יש חשבונית.",
  "מתנה שקיבלתי ולא התאימה.",
  "היה אצלי שנה אחת, נשמר היטב.",
  "שימוש עדין, מבית בלי עישון ובלי חיות.",
];
export const descIntroEn = [
  "In excellent condition, worn only a few times.",
  "Bought it and it did not suit me in the end.",
  "Clearing my wardrobe, everything is in good shape.",
  "I loved it but I no longer use it.",
  "Bought in store, I still have the receipt.",
  "A gift that did not fit.",
  "I had it for a year and looked after it well.",
  "Gentle use, from a smoke free and pet free home.",
];
export const descDetailHe = [
  "הצבע בתמונות מדויק.",
  "בלי כתמים ובלי קרעים.",
  "הבד נעים ולא נמתח.",
  "נשלח מכובס ומגוהץ.",
  "יש סימן קטן שנראה בתמונה האחרונה.",
  "מידה נכונה למידות שמצוינות באתר.",
];
export const descDetailEn = [
  "The colour in the photos is accurate.",
  "No stains and no tears.",
  "The fabric is soft and has not stretched.",
  "Washed and ironed before sending.",
  "There is one small mark, you can see it in the last photo.",
  "True to the size listed here.",
];
export const descOutroHe = [
  "אפשר לשלוח או לתאם איסוף.",
  "מוזמנים לשלוח הצעה.",
  "שולחת תוך יומיים אחרי התשלום.",
  "ענו לכל שאלה בשמחה.",
  "אפשר לקחת כמה פריטים ביחד ולקבל הנחה.",
];
export const descOutroEn = [
  "Happy to ship or arrange a pickup.",
  "Feel free to send an offer.",
  "I ship within two days of payment.",
  "Ask me anything.",
  "Take a few items together for a bundle discount.",
];

export function describe(rng: Rng, lang: "he" | "en", extra: string): string {
  const intro = lang === "he" ? descIntroHe : descIntroEn;
  const detail = lang === "he" ? descDetailHe : descDetailEn;
  const outro = lang === "he" ? descOutroHe : descOutroEn;
  return [rng.pick(intro), extra, rng.pick(detail), rng.pick(outro)].filter(Boolean).join(" ");
}

export const chatHe = {
  buyerOpen: [
    "היי, הפריט עדיין זמין?",
    "שלום, אפשר עוד תמונה?",
    "היי, מה המידות המדויקות?",
    "אהבתי מאוד! אפשר הנחה קטנה?",
  ],
  sellerReply: [
    "היי, כן עדיין זמין :)",
    "בטח, אעלה עוד תמונה היום.",
    "המידות מופיעות במודעה, אשמח לעזור אם צריך עוד.",
    "אפשר לשלוח הצעה ונראה.",
  ],
  buyerFollow: [
    "מעולה, תודה!",
    "אני חושב/ת על זה ואחזור אלייך.",
    "סבבה, אשלח הצעה.",
    "איזה כיף, אני מזמין/ה.",
  ],
  sellerClose: ["אשמח, תודה!", "אין בעד מה.", "אשלח ברגע שיש תשלום.", "בכיף."],
};
export const chatEn = {
  buyerOpen: [
    "Hi, is this still available?",
    "Hello, could you add another photo?",
    "Hi, what are the exact measurements?",
    "I love it! Could you do a little discount?",
  ],
  sellerReply: [
    "Hi, yes it is still available :)",
    "Sure, I will add more photos today.",
    "The sizes are in the listing, happy to help with more.",
    "Send me an offer and we will see.",
  ],
  buyerFollow: [
    "Great, thank you!",
    "I am thinking about it and will get back to you.",
    "Sounds good, I will send an offer.",
    "Lovely, I am buying it.",
  ],
  sellerClose: ["Thank you!", "You are welcome.", "I will ship it as soon as payment is in.", "Happy to."],
};

export const reviewHe = [
  "מוכרת מעולה, הכל כמו בתמונות ונשלח מהר.",
  "תקשורת נעימה ומהירה, ממליץ!",
  "הפריט הגיע ארוז יפה, תודה רבה.",
  "קונה נהדרת, שילמה מיד.",
  "עסקה חלקה, הכל כמו שתואר.",
  "שולחת מהר מאוד, ממליצה.",
];
export const reviewEn = [
  "Great seller, everything was as pictured and shipped fast.",
  "Pleasant and quick communication, recommended!",
  "The item arrived nicely packed, thank you.",
  "Wonderful buyer, paid right away.",
  "Smooth deal, everything as described.",
  "Ships very fast, would buy again.",
];
export const replyHe = ["תודה רבה!", "כיף לעשות עסקים, תודה!", "תהנו מהפריט :)"];
export const replyEn = ["Thank you so much!", "A pleasure doing business!", "Enjoy the item :)"];

export const reportDetails = [
  "נראה כמו העתק ולא מקורי.",
  "The photos look like they were taken from another site.",
  "המחיר לא מתאים לתיאור, חשד להונאה.",
];
