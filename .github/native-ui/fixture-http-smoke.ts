// Runs only inside with-fixture.sh for Unix/dev smoke. This is an in-memory
// client vault over real HTTP, NOT an iOS UI, SecureStore or physical result.
import assert from 'node:assert/strict';
import { SortexClient, type Vault } from '../../apps/mobile/src/api/client';
import { validateApiUrl } from '../../apps/mobile/src/api/config';
import type { Tokens } from '../../packages/contracts/src/mobile';

async function main() {
  assert.equal(process.env.SORTEX_IOS_UI_SCOPE, 'disposable-loopback');
  assert.equal(process.env.SORTEX_IOS_UI_API, 'http://127.0.0.1:3338');
  const password = process.env.SORTEX_IOS_UI_BUYER_PASSWORD;
  assert.ok(password && /^[0-9a-f]{48}$/.test(password));
  const base = validateApiUrl(process.env.SORTEX_IOS_UI_API, true);
  let tokens: Tokens | null = null;
  const vault: Vault = {
    async read() { return tokens; },
    async write(next) { tokens = next; },
    async clear() { tokens = null; },
  };
  const first = new SortexClient(base, vault);
  await first.login('sortex-ios-ui@example.test', password);
  assert.equal(first.snapshot().user?.name, 'CompradorIOS Sintetico');
  const page = await first.request<{ items: { slug: string; title: string }[] }>('/buyer/campaigns?page=1&limit=15');
  assert.deepEqual(page.items.map(({ slug, title }) => ({ slug, title })), [
    { slug: 'campanha-sintetica-ios', title: 'Campanha sintetica iOS' },
  ]);
  const item = await first.request<{ mainPrizeName: string; regulation: string }>('/public/campaigns/campanha-sintetica-ios');
  assert.equal(item.mainPrizeName, 'Premio sintetico iOS');
  assert.equal(item.regulation, 'Regulamento sintetico da campanha iOS.');
  const second = new SortexClient(base, vault);
  await second.restore();
  assert.equal(second.snapshot().user?.id, first.snapshot().user?.id);
  await second.logout();
  const third = new SortexClient(base, vault);
  await third.restore();
  assert.equal(third.snapshot().status, 'signedOut');
  console.log('Local HTTP mobile client assertions passed (no iOS simulator).');
}
main().catch(() => {
  console.error('Loopback HTTP mobile client assertions failed.');
  process.exitCode = 1;
});
