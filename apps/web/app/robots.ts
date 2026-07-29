import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: ["/"], disallow: ["/campanha/", "/admin/", "/dashboard/", "/comprador/", "/organizador/", "/api/", "/perfil", "/checkout/"] }, sitemap: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/sitemap.xml` };
}
