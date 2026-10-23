import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// The pages Google may list (see robots.ts): the front page and Info.
// Everything else is for members.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE.home}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.home}/info`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
