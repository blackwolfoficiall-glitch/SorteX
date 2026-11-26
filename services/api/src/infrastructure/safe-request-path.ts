// Invitation links contain a one-time credential, not a log identifier.
export function safeRequestPath(originalUrl: string): string {
  return originalUrl.replace(
    /(\/admin\/invitations\/)[^/?#]+(\/accept)?(?:[/?#].*)?$/i,
    '$1[redacted]$2',
  );
}
