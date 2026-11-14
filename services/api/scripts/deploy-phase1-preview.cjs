// Exclusive Phase 1 preview. The published homologacao IDs are never targets.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const target = Object.freeze({ project: 'rough-cherry-09901194', branch: 'br-weathered-grass-bcisqlpm', slug: 'sortexpreview', database: 'sortex_preview' });
async function deploy({ fetchImpl = fetch, readZip = () => fs.readFileSync(path.resolve(__dirname, '../dist/neon/sortex-api.zip')), key = process.env.NEON_API_KEY } = {}) {
  if (!key) throw new Error('NEON_API_KEY must be provided by the protected Actions secret.');
  async function api(route, options = {}) {
    const r = await fetchImpl(`https://console.neon.tech/api/v2${route}`, { ...options, headers: { Authorization: `Bearer ${key}`, ...options.headers } });
    if (r.status === 404 && route.endsWith(`/functions/${target.slug}`)) return null;
    if (!r.ok) throw new Error(`Preview API HTTP ${r.status} at ${route}; private response omitted.`);
    return r.json();
  }
  const result = await api(`/projects/${target.project}`);
  const project = result.project ?? result;
  if (project.id !== target.project || project.name !== 'sortex-fase1-preview' || !/^free/.test(project.owner?.subscription_type ?? '')) throw new Error('Refusing a destination that is not the isolated Free preview project.');
  const { branch } = await api(`/projects/${target.project}/branches/${target.branch}`);
  if (branch?.id !== target.branch || branch.project_id !== target.project || branch.name !== 'fase1-preview') throw new Error('Refusing another branch.');
  const { databases } = await api(`/projects/${target.project}/branches/${target.branch}/databases`);
  if (!databases?.some((db) => db.name === target.database)) throw new Error('Preview database is missing.');
  const route = `/projects/${target.project}/branches/${target.branch}/functions/${target.slug}`;
  const existing = await api(route);
  const web = 'https://sortex-fase1-review.netlify.app';
  const environment = { NODE_ENV: 'production', APP_ENV: 'staging', WEB_URL: web, APP_URL: web, WEB_APP_URL: web, PUBLIC_WEB_URL: web, API_URL: 'https://preview.example.invalid', CORS_ALLOWED_ORIGINS: web, PAYMENT_ENV: 'sandbox', INTEGRATIONS_MODE: 'sandbox', EMAIL_DELIVERY_MODE: 'disabled', UPLOADS_DISABLED: 'true', ORGANIZER_UPLOAD_DIR: '/tmp/sortex-preview-uploads-disabled', PRISMA_USE_PG_ADAPTER: 'true', FEATURE_REAL_PAYMENTS: 'false', FEATURE_REAL_DRAWS: 'false', FEATURE_PAYOUTS: 'false', FEATURE_EXTERNAL_CRM: 'false', FEATURE_WHATSAPP: 'false', FEATURE_VIDEO_RENDERING: 'false', APP_VERSION: process.env.GITHUB_SHA || 'phase1-preview' };
  if (!existing) for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'INTEGRATION_ENCRYPTION_KEY']) environment[name] = randomBytes(32).toString('hex');
  const zip = readZip();
  if (zip.length > 10 * 1024 * 1024) throw new Error('Preview ZIP exceeds the runtime limit.');
  const form = new FormData();
  form.set('zip', new Blob([zip], { type: 'application/zip' }), 'sortex-api.zip');
  form.set('runtime', 'nodejs24');
  if (!existing) form.set('environment', JSON.stringify(environment));
  await api(`${route}/deployments`, { method: 'POST', body: form });
  console.log('API bundle uploaded exclusively to the isolated Free Phase 1 preview. No migrations, production resources, or billing settings were modified.');
}
module.exports = { deploy, target };
if (require.main === module) deploy().catch((error) => { console.error(error.message); process.exitCode = 1; });
