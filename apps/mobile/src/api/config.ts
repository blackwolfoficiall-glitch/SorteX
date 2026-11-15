export const TEST_API =
  "https://sortex-fase1-review.netlify.app/.netlify/functions/sortex-api";
/** Never accept a production host, credentials, query string or arbitrary proxy. */
export function validateApiUrl(value: string, allowLocal = false): string {
  const u = new URL(value);
  if (u.username || u.password || u.search || u.hash)
    throw new Error(
      "A URL da API de teste não pode conter credenciais ou parâmetros.",
    );
  if (u.toString().replace(/\/$/, "") === TEST_API) return TEST_API;
  const privateHost =
    /^(127\.0\.0\.1|localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
      u.hostname,
    );
  if (
    allowLocal &&
    privateHost &&
    u.protocol === "http:" &&
    u.port === "3338" &&
    u.pathname === "/"
  )
    return u.origin;
  throw new Error(
    "Este aplicativo de desenvolvimento recusa APIs fora da prévia isolada. O ambiente principal está protegido.",
  );
}
