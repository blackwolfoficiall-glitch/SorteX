export default async function setup() {
  const root = "https://sortex-fase1-review.netlify.app";
  const api = root + "/.netlify/functions/sortex-api";
  const response = await fetch(api + "/health/ready", { signal: AbortSignal.timeout(60000), redirect: "manual" });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("The isolated preview API must be ready and accessible before mutation tests. No other site will be used.");
  const body = await response.json();
  if (body.status !== "ready" || body.database !== "up") throw new Error("The isolated preview database is not ready. Mutation tests were not started.");
  const page = await fetch(root + "/cadastro/comprador");
  if (!page.ok) throw new Error("The isolated registration page is unavailable.");
  const html = await page.text();
  for (const extension of ["js", "css"]) {
    const asset = html.match(new RegExp(`/_next/static/[^"<>]+\\.${extension}(?=["?])`))?.[0];
    if (!asset) throw new Error("The registration page is missing its public assets.");
    const result = await fetch(root + asset);
    const type = result.headers.get("content-type") ?? "";
    if (!result.ok || !type.includes(extension === "js" ? "javascript" : "text/css")) throw new Error("The preview's Next.js assets must load before mutation tests.");
  }
}
