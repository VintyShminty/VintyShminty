import type { NextConfig } from "next";

// The browser only ever talks to the website's own address, so the login cookie belongs to the website.
// These two forwards send the calls on to the server (Safari and Chrome block cookies from another address).
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
    return [
      { source: "/api/auth/:path*", destination: `${apiUrl}/api/auth/:path*` },
      { source: "/v1/:path*", destination: `${apiUrl}/v1/:path*` },
    ];
  },
};

export default config;
