// Vercel turns each server file into JavaScript but leaves our workspace packages (@vinty/db, @vinty/shared)
// as TypeScript, which Node cannot run. This bundles the server and those packages into server.mjs. Vercel picks
// a top level server.mjs ahead of src/index.ts as the entry point, so the bundle is what runs.
// npm packages the server depends on stay outside the bundle and load from node_modules as usual.
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith("@vinty/"));

await build({
  entryPoints: ["src/index.ts"],
  outfile: "server.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external,
  // Bundled CommonJS code may still call require.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});
