import path from 'node:path';
import { pathToFileURL } from 'node:url';

const site = 'af720ddb-9366-4e26-bcfe-d92ea8c27caf';
const prefix = '/.netlify/functions/sortex-api';
const apiUrl = `https://sortex-fase1-review.netlify.app${prefix}`;
const variables = ['DATABASE_URL', 'NODE_ENV', 'APP_ENV', 'WEB_URL', 'APP_URL', 'WEB_APP_URL', 'PUBLIC_WEB_URL', 'API_URL', 'CORS_ALLOWED_ORIGINS', 'PAYMENT_ENV', 'INTEGRATIONS_MODE', 'EMAIL_DELIVERY_MODE', 'UPLOADS_DISABLED', 'ORGANIZER_UPLOAD_DIR', 'PRISMA_USE_PG_ADAPTER', 'FEATURE_REAL_PAYMENTS', 'FEATURE_REAL_DRAWS', 'FEATURE_PAYOUTS', 'FEATURE_EXTERNAL_CRM', 'FEATURE_WHATSAPP', 'FEATURE_VIDEO_RENDERING', 'APP_VERSION', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'INTEGRATION_ENCRYPTION_KEY', 'OAUTH_WEB_ORIGIN', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'APPLE_OAUTH_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'];

export function createPreviewHandler({
  readEnv = (name) => globalThis.Netlify?.env?.get(name) ?? process.env[name],
  loadApplication = () => import(pathToFileURL(path.resolve(process.env.LAMBDA_TASK_ROOT || process.cwd(), '.sortex-preview-runtime/index.mjs')).href),
} = {}) {
  let application;
  return async (request, context) => {
    if (context?.site?.id !== site) throw new Error('This adapter is restricted to the isolated Phase 1 preview site.');
    const database = new URL(readEnv('DATABASE_URL'));
    if (!['ep-old-dawn-bcrbqzmd.c-16.us-east-1.aws.neon.tech', 'ep-old-dawn-bcrbqzmd-pooler.c-16.us-east-1.aws.neon.tech'].includes(database.hostname) || database.pathname !== '/sortex_preview') throw new Error('Refusing a database outside the isolated preview.');
    if (readEnv('API_URL') !== apiUrl || readEnv('APP_ENV') !== 'staging' || readEnv('PAYMENT_ENV') !== 'sandbox' || readEnv('INTEGRATIONS_MODE') !== 'sandbox' || readEnv('UPLOADS_DISABLED') !== 'true' || readEnv('EMAIL_DELIVERY_MODE') !== 'disabled') throw new Error('Refusing an unsafe preview configuration.');
    const url = new URL(request.url);
    if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return new Response('Not found', { status: 404 });
    for (const name of variables) { const value = readEnv(name); if (value !== undefined) process.env[name] = value; }
    if (!application) application = loadApplication().then((module) => module.default).catch((error) => { application = undefined; throw error; });
    const app = await application;
    url.pathname = url.pathname.slice(prefix.length) || '/';
    const forwarded = new Request(url, { method: request.method, headers: request.headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer() });
    const response = await app.fetch(forwarded);
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}
export default createPreviewHandler();
