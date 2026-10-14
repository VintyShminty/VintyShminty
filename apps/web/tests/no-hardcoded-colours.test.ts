import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Same rule as the app (docs/playbook/design-philosophy.md): every colour is a named token, defined once in
// packages/design/tokens.js. This test fails if a raw colour value shows up in website code.
const root = join(__dirname, "..");
const SCANNED_DIRS = ["app", "components", "lib"];
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".css"];

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_])/g;
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch)\(/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return EXTENSIONS.some((ext) => name.endsWith(ext)) ? [path] : [];
  });
}

function findings() {
  const found: string[] = [];
  for (const dir of SCANNED_DIRS) {
    for (const file of sourceFiles(join(root, dir))) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          for (const pattern of [HEX, COLOUR_FUNCTION]) {
            pattern.lastIndex = 0;
            const match = pattern.exec(line);
            if (match) found.push(`${relative(root, file)}:${index + 1}  ${match[0]}`);
          }
        });
    }
  }
  return found;
}

describe("design tokens on the website", () => {
  it("has no hard-coded colours in app, components or lib", () => {
    expect(findings(), "Use a token from packages/design/tokens.js or a Tailwind class instead").toEqual([]);
  });

  it("catches a hard-coded colour (self-test)", () => {
    expect("const c = '#4B2E22'".match(HEX)).not.toBeNull();
    expect("color: rgb(0, 0, 0)".match(COLOUR_FUNCTION)).not.toBeNull();
    expect("className='bg-accent'".match(HEX)).toBeNull();
  });
});
