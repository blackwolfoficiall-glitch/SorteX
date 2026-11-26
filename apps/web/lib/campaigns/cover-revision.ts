/** Append only the server's opaque cover revision; preserve the canonical path. */
export function versionedCoverUrl(
  url: string,
  revision?: string | null,
): string {
  return revision && /^[a-f0-9]{16}$/.test(revision)
    ? `${url}${url.includes("?") ? "&" : "?"}v=${revision}`
    : url;
}
