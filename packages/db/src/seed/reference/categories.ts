import type { CategoryRules, CategorySeed } from "./types.js";

type Opts = Pick<CategorySeed, "icon" | "sizes" | "rules" | "parcel">;

/** Short builder: slug, English, Hebrew, children or options. */
function c(slug: string, en: string, he: string, a?: CategorySeed[] | Opts, b?: Opts): CategorySeed {
  const children = Array.isArray(a) ? a : undefined;
  const opts = (Array.isArray(a) ? b : a) ?? {};
  return { slug, en, he, ...opts, ...(children ? { children } : {}) };
}

const clothingRules: CategoryRules = { size: "required", material: "optional", pattern: "optional" };
const shoeRules: CategoryRules = { size: "required", material: "optional" };
const noExtras: CategoryRules = { size: "hidden", material: "hidden", pattern: "hidden" };
const mediaRules: CategoryRules = {
  brand: "hidden",
  colour: "hidden",
  size: "hidden",
  material: "hidden",
  pattern: "hidden",
};

const womenClothingSizes = ["clothing-letter", "women-numeric"];
const womenJeansSizes = ["women-waist", "women-numeric", "clothing-letter"];
const menClothingSizes = ["clothing-letter"];
const menTrouserSizes = ["men-waist", "clothing-letter"];

const womenClothing = c(
  "clothing",
  "Clothing",
  "ביגוד",
  [
    c(
      "dresses",
      "Dresses",
      "שמלות",
      [
        c("mini", "Mini dresses", "שמלות מיני"),
        c("midi", "Midi dresses", "שמלות מידי"),
        c("maxi", "Maxi dresses", "שמלות מקסי"),
        c("evening", "Evening dresses", "שמלות ערב", { icon: "sparkles" }),
        c("casual", "Casual dresses", "שמלות יומיומיות"),
      ],
      { icon: "shirt" },
    ),
    c("tops", "Tops and t-shirts", "חולצות וטישרטים", [
      c("t-shirts", "T-shirts", "חולצות טי"),
      c("blouses", "Blouses and shirts", "חולצות מכופתרות וחולצות אלגנט"),
      c("tank-tops", "Tank tops", "גופיות"),
      c("crop-tops", "Crop tops", "קרופ טופ"),
      c("bodysuits", "Bodysuits", "בגדי גוף"),
    ]),
    c("knitwear", "Jumpers and sweaters", "סריגים וסוודרים", [
      c("pullovers", "Pullovers", "סוודרים"),
      c("cardigans", "Cardigans", "קרדיגנים"),
      c("hoodies", "Hoodies and sweatshirts", "קפוצ'ונים וסווטשירטים"),
      c("turtlenecks", "Turtlenecks", "גולף"),
    ]),
    c(
      "jeans",
      "Jeans",
      "ג'ינסים",
      [
        c("skinny", "Skinny jeans", "ג'ינס סקיני"),
        c("straight", "Straight jeans", "ג'ינס ישר"),
        c("wide-leg", "Wide leg jeans", "ג'ינס רחב"),
        c("boyfriend", "Boyfriend and mom jeans", "ג'ינס בויפרנד ומום"),
        c("denim-shorts", "Denim shorts", "ג'ינס קצר"),
      ],
      { sizes: womenJeansSizes },
    ),
    c("trousers", "Trousers and leggings", "מכנסיים וטייטס", [
      c("wide-trousers", "Wide leg trousers", "מכנסיים רחבים"),
      c("chinos", "Tailored trousers", "מכנסי בד"),
      c("leggings", "Leggings", "טייטס"),
      c("joggers", "Joggers", "מכנסי טרנינג"),
      c("shorts", "Shorts", "מכנסיים קצרים"),
    ]),
    c("skirts", "Skirts", "חצאיות", [
      c("mini", "Mini skirts", "חצאיות מיני"),
      c("midi", "Midi skirts", "חצאיות מידי"),
      c("maxi", "Maxi skirts", "חצאיות מקסי"),
    ]),
    c("outerwear", "Coats and jackets", "מעילים וג'קטים", [
      c("coats", "Coats", "מעילים"),
      c("jackets", "Jackets", "ג'קטים"),
      c("blazers", "Blazers", "בלייזרים"),
      c("trench", "Trench coats", "טרנצ'קוטים"),
      c("puffer", "Puffer jackets", "מעילי פוך"),
      c("denim-jackets", "Denim jackets", "ג'קטים מג'ינס"),
      c("gilets", "Gilets and waistcoats", "אפודות"),
    ]),
    c("jumpsuits", "Jumpsuits and playsuits", "אוברולים וסרבלים"),
    c(
      "swimwear",
      "Swimwear",
      "בגדי ים",
      [
        c("bikinis", "Bikinis", "ביקיני"),
        c("one-piece", "One piece swimsuits", "בגדי ים שלמים"),
        c("cover-ups", "Cover ups", "כיסויי חוף"),
      ],
      { icon: "waves" },
    ),
    c(
      "lingerie",
      "Lingerie and nightwear",
      "הלבשה תחתונה ופיג'מות",
      [
        c("bras", "Bras", "חזיות"),
        c("pyjamas", "Pyjamas", "פיג'מות"),
        c("underwear", "Underwear", "תחתונים"),
      ],
      { icon: "moon" },
    ),
    c(
      "activewear",
      "Activewear",
      "בגדי ספורט",
      [
        c("sports-bras", "Sports bras", "חזיות ספורט"),
        c("gym-leggings", "Gym leggings", "טייטס ספורט"),
        c("sports-tops", "Sports tops", "חולצות ספורט"),
      ],
      { icon: "dumbbell" },
    ),
    c("maternity", "Maternity clothes", "בגדי הריון", { icon: "baby" }),
  ],
  { icon: "shirt", sizes: womenClothingSizes, rules: clothingRules, parcel: "small" },
);

const womenShoes = c(
  "shoes",
  "Shoes",
  "נעליים",
  [
    c("sneakers", "Sneakers", "סניקרס", { icon: "footprints" }),
    c("boots", "Boots", "מגפיים", [
      c("ankle-boots", "Ankle boots", "מגפונים"),
      c("knee-boots", "Knee high boots", "מגפיים עד הברך"),
      c("rain-boots", "Rain boots", "מגפי גשם"),
    ]),
    c("heels", "Heels", "נעלי עקב"),
    c("flats", "Flats and ballet shoes", "נעליים שטוחות ובלרינות"),
    c("sandals", "Sandals", "סנדלים"),
    c("loafers", "Loafers and moccasins", "מוקסינים"),
    c("slippers", "Slippers and flip flops", "כפכפים ונעלי בית"),
    c("sports", "Sports shoes", "נעלי ספורט"),
  ],
  { icon: "footprints", sizes: ["shoes-women"], rules: shoeRules, parcel: "medium" },
);

const womenBags = c(
  "bags",
  "Bags",
  "תיקים",
  [
    c("handbags", "Handbags", "תיקי יד"),
    c("shoulder", "Shoulder bags", "תיקי כתף"),
    c("crossbody", "Crossbody bags", "תיקי צד"),
    c("totes", "Tote bags", "תיקי טוט"),
    c("backpacks", "Backpacks", "תיקי גב"),
    c("clutches", "Clutches", "קלאץ'ים"),
    c("wallets", "Wallets and purses", "ארנקים"),
    c("travel", "Travel bags", "תיקי נסיעות"),
  ],
  {
    icon: "shopping-bag",
    sizes: [],
    rules: { size: "hidden", material: "optional", pattern: "optional" },
    parcel: "medium",
  },
);

const womenAccessories = c(
  "accessories",
  "Accessories",
  "אקססוריז",
  [
    c(
      "jewellery",
      "Jewellery",
      "תכשיטים",
      [
        c("necklaces", "Necklaces", "שרשראות"),
        c("earrings", "Earrings", "עגילים"),
        c("rings", "Rings", "טבעות"),
        c("bracelets", "Bracelets", "צמידים"),
        c("sets", "Jewellery sets", "סטים של תכשיטים"),
      ],
      { icon: "gem", rules: { material: "optional", size: "hidden" }, parcel: "small" },
    ),
    c("watches", "Watches", "שעונים", { icon: "watch", parcel: "small" }),
    c("sunglasses", "Sunglasses", "משקפי שמש", { icon: "glasses", parcel: "small" }),
    c("scarves", "Scarves and shawls", "צעיפים ושלים", {
      icon: "wind",
      sizes: ["one-size"],
      rules: { size: "optional", material: "optional", pattern: "optional" },
    }),
    c("belts", "Belts", "חגורות", {
      sizes: ["belt", "clothing-letter"],
      rules: { size: "optional", material: "optional" },
    }),
    c("hats", "Hats and caps", "כובעים", {
      sizes: ["one-size", "clothing-letter"],
      rules: { size: "optional" },
    }),
    c("hair", "Hair accessories", "אביזרי שיער", { icon: "sparkles", parcel: "small" }),
    c("gloves", "Gloves", "כפפות", { sizes: ["clothing-letter", "one-size"], rules: { size: "optional" } }),
  ],
  { icon: "gem", sizes: [], rules: { size: "hidden", pattern: "optional" }, parcel: "small" },
);

const womenBeauty = c(
  "beauty",
  "Beauty",
  "טיפוח ויופי",
  [
    c("makeup", "Makeup", "איפור"),
    c("skincare", "Skincare", "טיפוח העור"),
    c("fragrance", "Fragrance", "בשמים"),
    c("hair-care", "Hair care and tools", "טיפוח שיער ומכשירים"),
  ],
  { icon: "sparkles", sizes: [], rules: { ...noExtras, colour: "hidden" }, parcel: "small" },
);

const menClothing = c(
  "clothing",
  "Clothing",
  "ביגוד",
  [
    c("t-shirts", "T-shirts and polo shirts", "חולצות טי ופולו", [
      c("t-shirts", "T-shirts", "חולצות טי"),
      c("polos", "Polo shirts", "חולצות פולו"),
      c("tank-tops", "Tank tops", "גופיות"),
    ]),
    c("shirts", "Shirts", "חולצות מכופתרות", [
      c("casual", "Casual shirts", "חולצות קז'ואל"),
      c("formal", "Formal shirts", "חולצות אלגנט"),
      c("linen", "Linen shirts", "חולצות פשתן"),
    ]),
    c("knitwear", "Jumpers and hoodies", "סריגים וקפוצ'ונים", [
      c("hoodies", "Hoodies and sweatshirts", "קפוצ'ונים וסווטשירטים"),
      c("pullovers", "Pullovers", "סוודרים"),
      c("cardigans", "Cardigans", "קרדיגנים"),
    ]),
    c(
      "jeans",
      "Jeans",
      "ג'ינסים",
      [
        c("slim", "Slim jeans", "ג'ינס סלים"),
        c("straight", "Straight jeans", "ג'ינס ישר"),
        c("relaxed", "Relaxed jeans", "ג'ינס רחב"),
      ],
      { sizes: menTrouserSizes },
    ),
    c(
      "trousers",
      "Trousers and shorts",
      "מכנסיים ומכנסיים קצרים",
      [
        c("chinos", "Chinos", "צ'ינוס"),
        c("joggers", "Joggers", "מכנסי טרנינג"),
        c("shorts", "Shorts", "מכנסיים קצרים"),
        c("cargo", "Cargo trousers", "מכנסי דגמ״ח"),
      ],
      { sizes: menTrouserSizes },
    ),
    c("suits", "Suits and blazers", "חליפות וג'קטים", [
      c("suits", "Suits", "חליפות"),
      c("blazers", "Blazers", "בלייזרים"),
      c("waistcoats", "Waistcoats", "אפודות חליפה"),
    ]),
    c("outerwear", "Coats and jackets", "מעילים וג'קטים", [
      c("coats", "Coats", "מעילים"),
      c("jackets", "Jackets", "ג'קטים"),
      c("puffer", "Puffer jackets", "מעילי פוך"),
      c("denim-jackets", "Denim jackets", "ג'קטים מג'ינס"),
      c("raincoats", "Raincoats", "מעילי גשם"),
    ]),
    c(
      "activewear",
      "Activewear",
      "בגדי ספורט",
      [
        c("sports-tops", "Sports tops", "חולצות ספורט"),
        c("sports-shorts", "Sports shorts", "מכנסי ספורט"),
        c("tracksuits", "Tracksuits", "חליפות אימון"),
      ],
      { icon: "dumbbell" },
    ),
    c("swimwear", "Swimwear", "בגדי ים", { icon: "waves" }),
    c("underwear", "Underwear and socks", "תחתונים וגרביים", { icon: "moon" }),
    c("pyjamas", "Pyjamas", "פיג'מות", { icon: "moon" }),
  ],
  { icon: "shirt", sizes: menClothingSizes, rules: clothingRules, parcel: "small" },
);

const menShoes = c(
  "shoes",
  "Shoes",
  "נעליים",
  [
    c("sneakers", "Sneakers", "סניקרס"),
    c("boots", "Boots", "מגפיים"),
    c("formal", "Formal shoes", "נעליים אלגנטיות"),
    c("loafers", "Loafers and moccasins", "מוקסינים"),
    c("sandals", "Sandals and flip flops", "סנדלים וכפכפים"),
    c("sports", "Sports shoes", "נעלי ספורט", [
      c("running", "Running shoes", "נעלי ריצה"),
      c("football", "Football boots", "נעלי כדורגל"),
      c("basketball", "Basketball shoes", "נעלי כדורסל"),
    ]),
  ],
  { icon: "footprints", sizes: ["shoes-men"], rules: shoeRules, parcel: "medium" },
);

const menAccessories = c(
  "accessories",
  "Accessories",
  "אקססוריז",
  [
    c(
      "bags",
      "Bags and backpacks",
      "תיקים ותיקי גב",
      [
        c("backpacks", "Backpacks", "תיקי גב"),
        c("messenger", "Messenger bags", "תיקי צד"),
        c("wallets", "Wallets", "ארנקים"),
      ],
      { icon: "backpack", parcel: "medium" },
    ),
    c("watches", "Watches", "שעונים", { icon: "watch" }),
    c("belts", "Belts", "חגורות", {
      sizes: ["belt", "clothing-letter"],
      rules: { size: "optional", material: "optional" },
    }),
    c("hats", "Hats and caps", "כובעים", {
      sizes: ["one-size", "clothing-letter"],
      rules: { size: "optional" },
    }),
    c("sunglasses", "Sunglasses", "משקפי שמש", { icon: "glasses" }),
    c("ties", "Ties and pocket squares", "עניבות ומטפחות כיס"),
    c("scarves", "Scarves", "צעיפים", { sizes: ["one-size"], rules: { size: "optional" } }),
    c("jewellery", "Jewellery", "תכשיטים", { icon: "gem" }),
  ],
  {
    icon: "watch",
    sizes: [],
    rules: { size: "hidden", pattern: "optional", material: "optional" },
    parcel: "small",
  },
);

const menGrooming = c(
  "grooming",
  "Grooming",
  "טיפוח",
  [
    c("fragrance", "Fragrance", "בשמים"),
    c("shaving", "Shaving and beard care", "גילוח וטיפוח זקן"),
    c("skincare", "Skincare", "טיפוח העור"),
  ],
  { icon: "scissors", sizes: [], rules: { ...noExtras, colour: "hidden" }, parcel: "small" },
);

const kidsClothingBase = (girl: boolean) => [
  c("tops", "T-shirts and tops", "חולצות וטישרטים"),
  c("trousers", "Trousers and jeans", "מכנסיים וג'ינסים"),
  girl ? c("dresses", "Dresses", "שמלות") : c("shorts", "Shorts", "מכנסיים קצרים"),
  girl ? c("skirts", "Skirts", "חצאיות") : c("hoodies", "Hoodies and jumpers", "קפוצ'ונים וסריגים"),
  c("outerwear", "Coats and jackets", "מעילים וג'קטים"),
  c("pyjamas", "Pyjamas", "פיג'מות"),
  c("swimwear", "Swimwear", "בגדי ים"),
];

const kids = c(
  "kids",
  "Kids",
  "ילדים",
  [
    c("girls", "Girls' clothing", "בגדי בנות", kidsClothingBase(true), { icon: "shirt" }),
    c("boys", "Boys' clothing", "בגדי בנים", kidsClothingBase(false), { icon: "shirt" }),
    c(
      "baby",
      "Baby clothing",
      "בגדי תינוקות",
      [
        c("bodysuits", "Bodysuits and rompers", "בגדי גוף ואוברולים"),
        c("sets", "Baby sets", "סטים לתינוקות"),
        c("sleepwear", "Sleepwear", "בגדי שינה"),
        c("outerwear", "Baby coats and snowsuits", "מעילים וסרבלי חורף"),
      ],
      { icon: "baby" },
    ),
    c(
      "shoes",
      "Kids' shoes",
      "נעלי ילדים",
      [
        c("sneakers", "Sneakers", "סניקרס"),
        c("sandals", "Sandals", "סנדלים"),
        c("boots", "Boots", "מגפיים"),
        c("baby-shoes", "Baby shoes", "נעלי תינוקות"),
      ],
      { icon: "footprints", sizes: ["shoes-kids"], rules: shoeRules, parcel: "medium" },
    ),
    c(
      "toys",
      "Toys",
      "צעצועים",
      [
        c("building", "Building sets", "משחקי הרכבה"),
        c("dolls", "Dolls and doll houses", "בובות ובתי בובות"),
        c("soft", "Soft toys", "בובות פרווה"),
        c("games", "Games and puzzles", "משחקים ופאזלים"),
        c("outdoor", "Outdoor toys", "צעצועי חוץ"),
        c("educational", "Educational toys", "צעצועים לימודיים"),
      ],
      { icon: "toy-brick", sizes: [], rules: { ...noExtras, size: "hidden" }, parcel: "medium" },
    ),
    c(
      "gear",
      "Strollers and car seats",
      "עגלות וכסאות בטיחות",
      [
        c("strollers", "Strollers", "עגלות"),
        c("car-seats", "Car seats", "כסאות בטיחות לרכב"),
        c("carriers", "Baby carriers", "מנשאים"),
      ],
      { icon: "car", sizes: [], rules: noExtras, parcel: "extra-large" },
    ),
    c(
      "nursery",
      "Nursery and kids' furniture",
      "חדר ילדים וריהוט",
      [
        c("cots", "Cots and cribs", "מיטות ועריסות"),
        c("high-chairs", "High chairs", "כסאות אוכל"),
        c("bedding", "Kids' bedding", "מצעים לילדים"),
        c("storage", "Storage and shelves", "אחסון ומדפים"),
      ],
      { icon: "bed-double", sizes: [], rules: noExtras, parcel: "extra-large" },
    ),
    c("school", "School and stationery", "בית ספר וצרכי משרד", {
      icon: "backpack",
      sizes: [],
      rules: noExtras,
      parcel: "small",
    }),
  ],
  { icon: "baby", sizes: ["kids-age"], rules: clothingRules, parcel: "small" },
);

const homeRules: CategoryRules = { size: "hidden", pattern: "hidden", material: "optional" };

const home = c(
  "home",
  "Home",
  "בית",
  [
    c(
      "furniture",
      "Furniture",
      "ריהוט",
      [
        c("sofas", "Sofas and armchairs", "ספות וכורסאות"),
        c("tables", "Tables and desks", "שולחנות ושולחנות כתיבה"),
        c("chairs", "Chairs and stools", "כסאות וכסאות בר"),
        c("storage", "Shelves and storage", "מדפים ואחסון"),
        c("beds", "Beds and mattresses", "מיטות ומזרנים"),
      ],
      { icon: "sofa", parcel: "extra-large" },
    ),
    c(
      "kitchen",
      "Kitchen and dining",
      "מטבח וסעודה",
      [
        c("cookware", "Pots and pans", "סירים ומחבתות"),
        c("tableware", "Plates and tableware", "צלחות וכלי אוכל"),
        c("glassware", "Glasses and drinkware", "כוסות וכלי שתייה"),
        c("appliances", "Small appliances", "מכשירי חשמל קטנים"),
        c("cutlery", "Cutlery and utensils", "סכו״ם וכלי מטבח"),
      ],
      { icon: "utensils", parcel: "large" },
    ),
    c(
      "decor",
      "Home decor",
      "עיצוב הבית",
      [
        c("vases", "Vases and pots", "אגרטלים וכלים"),
        c("frames", "Frames and mirrors", "מסגרות ומראות"),
        c("candles", "Candles and holders", "נרות ופמוטים"),
        c("rugs", "Rugs", "שטיחים"),
        c("cushions", "Cushions and throws", "כריות ושמיכות נוי"),
        c("art", "Wall art and posters", "אמנות קיר ופוסטרים"),
      ],
      { icon: "flower-2", parcel: "medium" },
    ),
    c(
      "textiles",
      "Bedding and textiles",
      "מצעים וטקסטיל",
      [
        c("bedding", "Bedding sets", "סטים של מצעים"),
        c("towels", "Towels", "מגבות"),
        c("curtains", "Curtains", "וילונות"),
      ],
      { icon: "bed-double", parcel: "medium" },
    ),
    c(
      "lighting",
      "Lighting",
      "תאורה",
      [
        c("lamps", "Table and floor lamps", "מנורות שולחן ורצפה"),
        c("pendants", "Pendant lights", "מנורות תלויות"),
      ],
      { icon: "lamp", parcel: "large" },
    ),
    c(
      "garden",
      "Garden and outdoor",
      "גינה וחוץ",
      [
        c("pots", "Plant pots", "עציצים"),
        c("furniture", "Garden furniture", "ריהוט גינה"),
        c("tools", "Garden tools", "כלי גינון"),
      ],
      { icon: "sun", parcel: "large" },
    ),
    c("pets", "Pet supplies", "מוצרים לחיות מחמד", { icon: "heart", parcel: "medium" }),
  ],
  { icon: "house", sizes: [], rules: homeRules, parcel: "medium" },
);

const electronics = c(
  "electronics",
  "Electronics",
  "אלקטרוניקה",
  [
    c(
      "phones",
      "Phones",
      "טלפונים",
      [
        c("smartphones", "Smartphones", "סמארטפונים"),
        c("cases", "Cases and screen protectors", "כיסויים ומגני מסך"),
        c("chargers", "Chargers and cables", "מטענים וכבלים"),
      ],
      { icon: "smartphone", parcel: "small" },
    ),
    c(
      "computers",
      "Computers",
      "מחשבים",
      [
        c("laptops", "Laptops", "מחשבים ניידים"),
        c("tablets", "Tablets", "טאבלטים"),
        c("monitors", "Monitors", "מסכים"),
        c("peripherals", "Keyboards and mice", "מקלדות ועכברים"),
      ],
      { icon: "laptop", parcel: "large" },
    ),
    c(
      "audio",
      "Audio and headphones",
      "אודיו ואוזניות",
      [
        c("headphones", "Headphones", "אוזניות"),
        c("speakers", "Speakers", "רמקולים"),
        c("hifi", "Hi-fi and turntables", "מערכות סטריאו ופטיפונים"),
      ],
      { icon: "headphones", parcel: "medium" },
    ),
    c(
      "cameras",
      "Cameras",
      "מצלמות",
      [
        c("digital", "Digital cameras", "מצלמות דיגיטליות"),
        c("lenses", "Lenses", "עדשות"),
        c("action", "Action cameras and drones", "מצלמות אקשן ורחפנים"),
        c("tripods", "Tripods and accessories", "חצובות ואביזרים"),
      ],
      { icon: "camera", parcel: "medium" },
    ),
    c(
      "gaming",
      "Gaming",
      "גיימינג",
      [
        c("consoles", "Consoles", "קונסולות"),
        c("games", "Video games", "משחקי וידאו"),
        c("controllers", "Controllers and accessories", "שלטים ואביזרים"),
      ],
      { icon: "gamepad-2", parcel: "medium" },
    ),
    c("tv", "TV and smart home", "טלוויזיות ובית חכם", { icon: "tv", parcel: "extra-large" }),
    c("wearables", "Smartwatches and wearables", "שעונים חכמים", { icon: "watch", parcel: "small" }),
  ],
  {
    icon: "smartphone",
    sizes: [],
    rules: { brand: "optional", size: "hidden", colour: "optional", material: "hidden", pattern: "hidden" },
    parcel: "medium",
  },
);

const media = c(
  "media",
  "Books and media",
  "ספרים ומדיה",
  [
    c(
      "books",
      "Books",
      "ספרים",
      [
        c("fiction", "Fiction", "ספרי קריאה"),
        c("non-fiction", "Non fiction", "ספרי עיון"),
        c("kids", "Children's books", "ספרי ילדים"),
        c("comics", "Comics and manga", "קומיקס ומנגה"),
        c("textbooks", "Textbooks and study", "ספרי לימוד"),
        c("hebrew", "Hebrew literature", "ספרות עברית"),
        c("cookbooks", "Cookbooks", "ספרי בישול"),
      ],
      { icon: "book-open" },
    ),
    c("music", "Music", "מוזיקה", [c("vinyl", "Vinyl records", "תקליטים"), c("cds", "CDs", "דיסקים")], {
      icon: "music",
    }),
    c(
      "film",
      "Films and TV",
      "סרטים וטלוויזיה",
      [c("dvd", "DVDs", "DVD"), c("bluray", "Blu-ray", "בלו-ריי")],
      { icon: "film" },
    ),
    c("magazines", "Magazines", "מגזינים", { icon: "newspaper" }),
  ],
  { icon: "book-open", sizes: [], rules: mediaRules, parcel: "small" },
);

const hobbies = c(
  "hobbies",
  "Hobbies and collectables",
  "תחביבים ואספנות",
  [
    c(
      "games",
      "Games and puzzles",
      "משחקים ופאזלים",
      [
        c("board", "Board games", "משחקי קופסה"),
        c("puzzles", "Puzzles", "פאזלים"),
        c("cards", "Card games", "משחקי קלפים"),
      ],
      { icon: "puzzle", parcel: "medium" },
    ),
    c(
      "collectables",
      "Collectables",
      "אספנות",
      [
        c("trading-cards", "Trading cards", "קלפי אספנות"),
        c("coins", "Coins and stamps", "מטבעות ובולים"),
        c("figurines", "Figurines and statues", "פסלונים ודמויות"),
        c("vintage", "Vintage and antiques", "וינטג' ועתיקות"),
      ],
      { icon: "crown", parcel: "small" },
    ),
    c(
      "crafts",
      "Arts and crafts",
      "אמנות ויצירה",
      [
        c("painting", "Painting and drawing", "ציור ורישום"),
        c("sewing", "Sewing and knitting", "תפירה וסריגה"),
        c("beads", "Beads and jewellery making", "חרוזים ויצירת תכשיטים"),
      ],
      { icon: "palette", parcel: "medium" },
    ),
    c(
      "instruments",
      "Musical instruments",
      "כלי נגינה",
      [
        c("guitars", "Guitars and basses", "גיטרות ובסים"),
        c("keyboards", "Keyboards and pianos", "קלידים ופסנתרים"),
        c("drums", "Drums and percussion", "תופים ופרקשן"),
        c("other", "Other instruments", "כלי נגינה אחרים"),
      ],
      { icon: "music", parcel: "extra-large" },
    ),
    c("models", "Model kits and RC", "דגמים ושלט רחוק", { icon: "rocket", parcel: "medium" }),
  ],
  {
    icon: "palette",
    sizes: [],
    rules: { brand: "optional", size: "hidden", colour: "hidden", material: "hidden", pattern: "hidden" },
    parcel: "medium",
  },
);

const sports = c(
  "sports",
  "Sports",
  "ספורט",
  [
    c(
      "fitness",
      "Fitness and gym",
      "כושר וחדר כושר",
      [
        c("weights", "Weights and dumbbells", "משקולות"),
        c("yoga", "Yoga and pilates", "יוגה ופילאטיס"),
        c("cardio", "Cardio equipment", "ציוד אירובי"),
      ],
      { icon: "dumbbell" },
    ),
    c(
      "cycling",
      "Cycling",
      "רכיבה על אופניים",
      [
        c("bikes", "Bikes", "אופניים"),
        c("helmets", "Helmets", "קסדות"),
        c("clothing", "Cycling clothing", "ביגוד רכיבה", {
          sizes: ["clothing-letter"],
          rules: clothingRules,
        }),
        c("parts", "Parts and accessories", "חלקים ואביזרים"),
      ],
      { icon: "bike", parcel: "extra-large" },
    ),
    c("running", "Running", "ריצה", { icon: "footprints", parcel: "medium" }),
    c(
      "football",
      "Football",
      "כדורגל",
      [
        c("balls", "Balls", "כדורים"),
        c("shirts", "Football shirts", "חולצות כדורגל", {
          sizes: ["clothing-letter"],
          rules: clothingRules,
          parcel: "small",
        }),
        c("boots", "Football boots", "נעלי כדורגל", { sizes: ["shoes-men", "shoes-kids"], rules: shoeRules }),
      ],
      { icon: "trophy" },
    ),
    c(
      "racket",
      "Tennis, padel and matkot",
      "טניס, פאדל ומטקות",
      [
        c("rackets", "Rackets", "מחבטים"),
        c("balls", "Balls", "כדורים"),
        c("bags", "Sports bags", "תיקי ספורט"),
      ],
      { icon: "circle-dot" },
    ),
    c(
      "water",
      "Water sports",
      "ספורט ימי",
      [
        c("surf", "Surfing and SUP", "גלישה וסאפ"),
        c("swim", "Swimming gear", "ציוד שחייה"),
        c("diving", "Diving and snorkelling", "צלילה וסנורקלינג"),
      ],
      { icon: "waves" },
    ),
    c(
      "camping",
      "Camping and hiking",
      "קמפינג וטיולים",
      [
        c("tents", "Tents", "אוהלים"),
        c("backpacks", "Hiking backpacks", "תיקי טיולים"),
        c("sleeping", "Sleeping bags and mats", "שקי שינה ומזרנים"),
      ],
      { icon: "tent", parcel: "large" },
    ),
    c("team", "Basketball and team sports", "כדורסל וספורט קבוצתי", { icon: "trophy", parcel: "medium" }),
    c("winter", "Winter sports", "ספורט חורף", { icon: "snowflake", parcel: "extra-large" }),
  ],
  {
    icon: "dumbbell",
    sizes: [],
    rules: { brand: "optional", size: "hidden", colour: "optional", material: "hidden", pattern: "hidden" },
    parcel: "large",
  },
);

const designer = c(
  "designer",
  "Designer",
  "מותגי יוקרה",
  [
    c(
      "women",
      "Women's designer",
      "יוקרה לנשים",
      [
        c("bags", "Designer bags", "תיקי יוקרה", [], {
          icon: "shopping-bag",
          sizes: [],
          rules: { size: "hidden", material: "optional" },
          parcel: "medium",
        }),
        c(
          "clothing",
          "Designer clothing",
          "ביגוד יוקרה",
          [
            c("dresses", "Dresses", "שמלות"),
            c("tops", "Tops and knitwear", "חולצות וסריגים"),
            c("coats", "Coats and jackets", "מעילים וג'קטים"),
            c("trousers", "Trousers and jeans", "מכנסיים וג'ינסים"),
          ],
          { icon: "shirt", sizes: womenClothingSizes, rules: clothingRules, parcel: "small" },
        ),
        c("shoes", "Designer shoes", "נעלי יוקרה", {
          icon: "footprints",
          sizes: ["shoes-women"],
          rules: shoeRules,
          parcel: "medium",
        }),
        c("jewellery", "Jewellery and watches", "תכשיטים ושעונים", {
          icon: "gem",
          sizes: [],
          rules: { size: "hidden", material: "optional" },
          parcel: "small",
        }),
      ],
      { icon: "crown" },
    ),
    c(
      "men",
      "Men's designer",
      "יוקרה לגברים",
      [
        c(
          "clothing",
          "Designer clothing",
          "ביגוד יוקרה",
          [
            c("shirts", "Shirts and tops", "חולצות"),
            c("knitwear", "Knitwear and hoodies", "סריגים וקפוצ'ונים"),
            c("coats", "Coats and jackets", "מעילים וג'קטים"),
            c("trousers", "Trousers and jeans", "מכנסיים וג'ינסים"),
          ],
          { icon: "shirt", sizes: menClothingSizes, rules: clothingRules, parcel: "small" },
        ),
        c("shoes", "Designer shoes", "נעלי יוקרה", {
          icon: "footprints",
          sizes: ["shoes-men"],
          rules: shoeRules,
          parcel: "medium",
        }),
        c("bags", "Designer bags and wallets", "תיקים וארנקי יוקרה", {
          icon: "briefcase",
          sizes: [],
          rules: { size: "hidden", material: "optional" },
          parcel: "medium",
        }),
        c("accessories", "Watches and accessories", "שעונים ואקססוריז", {
          icon: "watch",
          sizes: [],
          rules: { size: "hidden", material: "optional" },
          parcel: "small",
        }),
      ],
      { icon: "crown" },
    ),
  ],
  { icon: "crown" },
);

export const categorySeed: CategorySeed[] = [
  c("women", "Women", "נשים", [womenClothing, womenShoes, womenBags, womenAccessories, womenBeauty], {
    icon: "user-round",
  }),
  c("men", "Men", "גברים", [menClothing, menShoes, menAccessories, menGrooming], { icon: "user" }),
  kids,
  home,
  electronics,
  media,
  hobbies,
  sports,
  designer,
];

/** Fixes the slug to the full slug and returns a flat list. Inheritance of sizes, rules, parcel and icon is applied here. */
export interface FlatCategory {
  slug: string;
  parentSlug: string | null;
  path: string;
  depth: number;
  en: string;
  he: string;
  icon: string;
  sortOrder: number;
  isLeaf: boolean;
  sizes: string[];
  rules: Required<CategoryRules>;
  parcel: string;
}

const defaultRules: Required<CategoryRules> = {
  brand: "optional",
  size: "hidden",
  condition: "required",
  colour: "optional",
  material: "hidden",
  pattern: "hidden",
};

export function flattenCategories(
  nodes: CategorySeed[] = categorySeed,
  parent?: Pick<FlatCategory, "slug" | "path" | "depth" | "icon" | "sizes" | "rules" | "parcel">,
): FlatCategory[] {
  const out: FlatCategory[] = [];
  nodes.forEach((node, index) => {
    const slug = parent ? `${parent.slug}-${node.slug}` : node.slug;
    const path = parent ? `${parent.path}/${node.slug}` : node.slug;
    const flat: FlatCategory = {
      slug,
      parentSlug: parent?.slug ?? null,
      path,
      depth: parent ? parent.depth + 1 : 0,
      en: node.en,
      he: node.he,
      icon: node.icon ?? parent?.icon ?? "tag",
      sortOrder: index + 1,
      isLeaf: !node.children || node.children.length === 0,
      sizes: node.sizes ?? parent?.sizes ?? [],
      rules: { ...(parent?.rules ?? defaultRules), ...node.rules },
      parcel: node.parcel ?? parent?.parcel ?? "small",
    };
    out.push(flat);
    if (node.children?.length) out.push(...flattenCategories(node.children, flat));
  });
  return out;
}
