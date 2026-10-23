import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Search engines may show the front page and Info, and read what those
// need to be drawn and listed (the app's files, the icons for the result's
// logo, the link picture) and the list of pages; nothing else. AI crawlers
// get nothing at all (src/proxy.ts turns them away regardless).
const AI_CRAWLERS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-User",
  "anthropic-ai", "CCBot", "Google-Extended", "Applebot-Extended",
  "PerplexityBot", "Bytespider", "Amazonbot", "meta-externalagent",
  "cohere-ai", "Diffbot", "Omgilibot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_CRAWLERS, disallow: "/" },
      {
        userAgent: "*",
        allow: ["/$", "/info", "/terms", "/privacy", "/_next/", "/icon", "/apple-icon", "/og.png", "/sitemap.xml"],
        disallow: "/",
      },
    ],
    sitemap: `${SITE.home}/sitemap.xml`,
    host: SITE.home,
  };
}
