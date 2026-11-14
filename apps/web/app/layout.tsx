import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./sortex-brand.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.WEB_URL || "http://localhost:3000"),
  title: { default: "SorteX", template: "%s | SorteX" },
  description: "Plataforma inteligente de campanhas premiadas.",
  applicationName: "SorteX",
  other: { "sortex:review-commit": process.env.NEXT_PUBLIC_SORTEX_REVIEW_COMMIT || "development" },
  openGraph: { type: "website", locale: "pt_BR", siteName: "SorteX" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
