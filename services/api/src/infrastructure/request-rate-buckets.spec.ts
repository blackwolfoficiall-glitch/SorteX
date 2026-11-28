import {
  bucketSweepIntervalMs,
  RequestRateBuckets,
} from './request-rate-buckets';

describe('RequestRateBuckets', () => {
  it('limita a admissão sem expulsar contadores ativos', () => {
    const buckets = new RequestRateBuckets(2);
    expect(buckets.increment('health', 1_000, 60_000)?.count).toBe(1);
    expect(buckets.increment('login', 1_100, 60_000)?.count).toBe(1);
    for (const key of ['new-route', 'new-session', 'new-ip']) {
      expect(buckets.increment(key, 1_250, 60_000)).toBeNull();
    }
    expect(buckets.increment('login', 1_500, 60_000)).toEqual({
      count: 2,
      resetAt: 61_100,
    });
  });

  it('recupera capacidade após a janela sem redefinir outros contadores', () => {
    const buckets = new RequestRateBuckets(2);
    expect(buckets.increment('expired', 0, 1_000)?.count).toBe(1);
    expect(buckets.increment('active', 0, 60_000)?.count).toBe(1);
    expect(buckets.increment('new', 999, 60_000)).toBeNull();
    expect(buckets.increment('new', bucketSweepIntervalMs, 60_000)?.count).toBe(
      1,
    );
    expect(buckets.increment('active', bucketSweepIntervalMs, 60_000)).toEqual({
      count: 2,
      resetAt: 60_000,
    });
  });
});
