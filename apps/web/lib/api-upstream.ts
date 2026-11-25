// One resolver for the Next build and server routes. The explicit homologation
// guard prevents a legacy setting from silently redirecting only one client.
export function resolveApiUpstream(env: NodeJS.ProcessEnv = process.env): string {
  const normalize = (value?: string) => value?.trim().replace(/\/+$/, "") || undefined;
  const internal = normalize(env.API_INTERNAL_URL);
  const legacy = normalize(env.API_URL);
  const playwright = normalize(env.PLAYWRIGHT_API_URL);
  const expected = normalize(env.SORTEX_HOMOLOGATION_API_URL);
  if (expected) {
    let valid = false;
    try {
      const url = new URL(expected);
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      valid =
        !url.username && !url.password && !url.search && !url.hash &&
        (url.protocol === "https:" || (loopback && url.protocol === "http:"));
    } catch {
      // Keep configuration errors free of endpoint contents and credentials.
    }
    if (!valid)
      throw new Error("SORTEX_HOMOLOGATION_API_URL deve ser uma URL de API válida.");
    if ([internal, legacy, playwright].some((value) => value && value !== expected))
      throw new Error("Os destinos da API divergem da homologação da SorteX.");
    return expected;
  }
  return internal || legacy || playwright || "http://localhost:3333";
}
