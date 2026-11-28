import { createHash } from 'node:crypto';

/** Changes only when the stored cover changes; never disclose the key itself. */
export function coverRevision(storageKey: string | null): string | null {
  return storageKey
    ? createHash('sha256').update(storageKey).digest('hex').slice(0, 16)
    : null;
}
