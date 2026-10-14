import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/** /robots.txt: everything is open except the forwarded server calls and the team's own dev pages. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/v1/", "/*/dev/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
