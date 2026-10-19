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
  poweredByHeader: false,
  // On every answer: always use the secure connection (HTTPS) for two years, never guess a file's type, send only the
  // site name to other sites, no other site may frame our pages, and no camera, microphone or location. The script rule
  // (Content Security Policy) is set per page in proxy.ts, because it needs a fresh random number each time.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async rewrites() {
    return [{ source: "/v1/:path*", destination: `${apiUrl}/v1/:path*` }];
  },
};

export default config;
