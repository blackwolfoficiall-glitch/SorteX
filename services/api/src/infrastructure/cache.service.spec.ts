import { MemoryCacheService } from './cache.service';
describe('MemoryCacheService', () => {
  it('expira e invalida prefixos', async () => {
    const c = new MemoryCacheService();
    await c.set('public:a', 1, 10);
    await c.set('private:a', 2, 10);
    expect(await c.get('public:a')).toBe(1);
    await c.invalidatePrefix('public:');
    expect(await c.get('public:a')).toBeUndefined();
    expect(await c.get('private:a')).toBe(2);
  });
});
