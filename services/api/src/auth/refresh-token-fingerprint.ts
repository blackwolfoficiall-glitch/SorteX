import { createHash, timingSafeEqual } from 'node:crypto';

const prefix = 'sha256:';
const format = /^sha256:[a-f0-9]{64}$/;

/** Refresh JWTs are high-entropy credentials. Bind the complete encoded token. */
export function fingerprintRefreshToken(token: string): string {
  return prefix + createHash('sha256').update(token, 'utf8').digest('hex');
}

export function matchesRefreshToken(
  token: string,
  fingerprint: string,
): boolean {
  if (!format.test(fingerprint)) return false;
  return timingSafeEqual(
    Buffer.from(fingerprintRefreshToken(token), 'ascii'),
    Buffer.from(fingerprint, 'ascii'),
  );
}
