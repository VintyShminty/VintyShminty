import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import en from "@vinty/locales/en.json";
import he from "@vinty/locales/he.json";
import { NOTIFICATION_SETTINGS_GROUPS, VALIDATION_MESSAGES } from "@vinty/shared";
import { describe, expect, it } from "vitest";

// Every user-facing string comes from the locale files. This test keeps English and Hebrew in step,
// finds t("...") keys that do not exist, and checks the writing rules (docs/design.md).
const root = join(__dirname, "..");

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object"
      ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

const enKeys = flatten(en);
const heKeys = flatten(he);
// Plural forms (key_one, key_two, key_other) count as the key itself.
const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, "");
const enBase = new Set(enKeys.map(base));
const heBase = new Set(heKeys.map(base));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("translations", () => {
  it("has the same keys in English and Hebrew", () => {
    expect([...enBase].filter((k) => !heBase.has(k))).toEqual([]);
    expect([...heBase].filter((k) => !enBase.has(k))).toEqual([]);
  });

  it("has every key that the code asks for", () => {
    const missing: string[] = [];
    for (const dir of ["app", "components", "lib"]) {
      for (const file of sourceFiles(join(root, dir))) {
        const text = readFileSync(file, "utf8");
        for (const match of text.matchAll(/\bt\(\s*"([a-zA-Z][\w.]*)"/g)) {
          const key = match[1] as string;
          if (!enBase.has(key)) missing.push(`${relative(root, file)}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("covers the validation messages of the shared schemas", () => {
    for (const key of VALIDATION_MESSAGES) {
      expect(enBase.has(key), `en ${key}`).toBe(true);
      expect(heBase.has(key), `he ${key}`).toBe(true);
    }
  });

  it("covers the notification types and groups shown in Settings", () => {
    for (const { group, types } of NOTIFICATION_SETTINGS_GROUPS) {
      expect(enBase.has(`notifications.groups.${group}`)).toBe(true);
      for (const type of types) {
        expect(enBase.has(`notifications.types.${type}`), type).toBe(true);
        expect(heBase.has(`notifications.types.${type}`), type).toBe(true);
      }
    }
  });

  it("follows the writing rules: no dashes or semicolons, no full stop on headings", () => {
    const problems: string[] = [];
    for (const [name, locale] of [
      ["en", en],
      ["he", he],
    ] as const) {
      const walk = (obj: Record<string, unknown>, path: string) => {
        for (const [key, value] of Object.entries(obj)) {
          if (value && typeof value === "object") walk(value as Record<string, unknown>, `${path}${key}.`);
          else if (typeof value === "string" && !path.startsWith("gallery")) {
            if (/[–—;]/.test(value)) problems.push(`${name} ${path}${key}: dash or semicolon`);
            // Headings carry no full stop. Sentences and abbreviations elsewhere may have one.
            if (/^(title|hero\w+)$|[a-z]Title$/.test(key) && value.endsWith("."))
              problems.push(`${name} ${path}${key}: full stop on a heading`);
          }
        }
      };
      walk(locale as Record<string, unknown>, "");
    }
    expect(problems).toEqual([]);
  });
});
