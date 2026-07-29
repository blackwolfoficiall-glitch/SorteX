import { Injectable } from '@nestjs/common';
type Entry = { value: unknown; expiresAt: number };
export interface CacheProvider {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  invalidatePrefix(prefix: string): Promise<void>;
}
@Injectable()
export class MemoryCacheService implements CacheProvider {
  private readonly values = new Map<string, Entry>();
  async get<T>(key: string) {
    const e = this.values.get(key);
    if (!e) return undefined;
    if (e.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return e.value as T;
  }
  async set<T>(key: string, value: T, ttlSeconds: number) {
    this.values.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
  async delete(key: string) {
    this.values.delete(key);
  }
  async invalidatePrefix(prefix: string) {
    for (const key of this.values.keys())
      if (key.startsWith(prefix)) this.values.delete(key);
  }
}
