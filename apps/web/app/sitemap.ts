import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
 const base = process.env.NEXT_PUBLIC_APP_URL || process.env.WEB_URL || "http://localhost:3000";
 return ["", "/contato", "/termos", "/privacidade"].map(path => ({ url: base + path, changeFrequency: "monthly" as const, priority: path ? 0.4 : 1 }));
}
