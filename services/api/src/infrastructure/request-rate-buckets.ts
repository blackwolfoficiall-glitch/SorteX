type Bucket = { count: number; resetAt: number };

export const bucketSweepIntervalMs = 5_000;

/**
 * Keep unrelated traffic from evicting existing counters and resetting their
 * budgets. New keys fail closed if all slots in this process are occupied.
 */
export class RequestRateBuckets {
  private readonly entries = new Map<string, Bucket>();
  private nextSweepAt = 0;

  constructor(private readonly capacity: number) {}

  increment(key: string, now: number, windowMs: number): Bucket | null {
    if (now >= this.nextSweepAt) {
      for (const [key, bucket] of this.entries) {
        if (bucket.resetAt <= now) this.entries.delete(key);
      }
      this.nextSweepAt = now + bucketSweepIntervalMs;
    }

    const current = this.entries.get(key);
    if (!current && this.entries.size >= this.capacity) return null;

    const bucket =
      current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + windowMs };
    bucket.count++;
    if (bucket !== current) this.entries.set(key, bucket);
    return bucket;
  }
}
