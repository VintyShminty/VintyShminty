import type { NextConfig } from "next";

// The browser only ever talks to the website's own address, so the login cookie belongs to the website.
// The forward for /v1 sits here. The one for /api/auth sits in proxy.ts because it adds a header (see there).
const apiUrl = (process.env.API_URL ?? "http://localhost:3000").replace(/\/$/, "");

const config: NextConfig = {
  agentRules: false,
  // The shared packages are TypeScript and JSON that Next has to compile itself.
  transpilePackages: ["@vinty/shared", "@vinty/design", "@vinty/locales"],
  // packages/shared imports its own files as "./x.js" (they are .ts files). Turbopack cannot map that, webpack can,
  // so the website builds with webpack (see the scripts in package.json).
  webpack(webpackConfig) {
    webpackConfig.resolve.extensionAlias = {
      ...webpackConfig.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return webpackConfig;
  },
  async rewrites() {
    return [{ source: "/v1/:path*", destination: `${apiUrl}/v1/:path*` }];
  },
};

export default config;
