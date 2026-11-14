import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: ["/"], disallow: ["/campanha/", "/admin/", "/dashboard/", "/comprador/", "/organizador/", "/api/", "/login", "/cadastro/", "/perfil", "/checkout/"] }, sitemap: `${process.env.NEXT_PUBLIC_APP_URL || process.env.WEB_URL || "http://localhost:3000"}/sitemap.xml` };
}
