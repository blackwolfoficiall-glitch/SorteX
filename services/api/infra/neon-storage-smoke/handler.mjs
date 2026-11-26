import { createHash, timingSafeEqual } from 'node:crypto';
import {
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { objectStorage } from '../../dist/src/organizers/object-storage.js';

export const branch = 'br-weathered-forest-bccwn49d';
export const bucket = 'sortex-qa-media';
export const endpoint =
  'https://br-weathered-forest-bccwn49d.storage.c-16.us-east-1.aws.neon.tech';
export const region = 'us-east-1';
export const fixture = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4GKIAAAMPATak7Av9AAAAAElFTkSuQmCC',
  'base64',
);
export const digest = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
const deadlineMs = 8 * 60_000;
const headers = { 'Cache-Control': 'no-store' };
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function singleAttemptStorage() {
  // Only affects this separate smoke runtime, not the Sortex web API Function.
  // AWS SDK v3 counts the initial request in AWS_MAX_ATTEMPTS.
  process.env.AWS_MAX_ATTEMPTS = '1';
  return objectStorage();
}

export function createHandler({
  env = process.env,
  clock = Date.now,
  getStorage = singleAttemptStorage,
  newReader = () =>
    new S3Client({ endpoint, region, forcePathStyle: true, maxAttempts: 1 }),
  request = fetch,
} = {}) {
  let started = false;
  return {
    async fetch(req) {
      // Authenticate before reading service configuration or calling any provider.
      const url = new URL(req.url);
      const match = /^Bearer ([0-9a-f]{64})$/.exec(
        req.headers.get('authorization') ?? '',
      );
      const hash = env.SORTEX_STORAGE_PROBE_HASH;
      const expires = Number(env.SORTEX_STORAGE_PROBE_EXPIRES_MS);
      const now = clock();
      if (
        req.method !== 'POST' ||
        url.search ||
        !['/preflight', '/probe'].includes(url.pathname) ||
        !match ||
        !/^[0-9a-f]{64}$/.test(hash ?? '') ||
        !Number.isSafeInteger(expires) ||
        expires <= now ||
        expires - now > deadlineMs ||
        !timingSafeEqual(
          Buffer.from(digest(match[1]), 'hex'),
          Buffer.from(hash, 'hex'),
        )
      ) {
        return new Response(null, { status: 404, headers });
      }
      if (
        env.NEON_BRANCH_ID !== branch ||
        env.STORAGE_DRIVER !== 'neon-s3' ||
        env.STORAGE_BUCKET !== bucket ||
        env.AWS_ENDPOINT_URL_S3?.replace(/\/$/, '') !== endpoint ||
        env.AWS_REGION !== region ||
        !env.AWS_ACCESS_KEY_ID ||
        !env.AWS_SECRET_ACCESS_KEY ||
        !uuid.test(env.SORTEX_STORAGE_PROBE_ID ?? '')
      ) {
        return Response.json(
          { ok: false, phase: 'runtime' },
          { status: 503, headers },
        );
      }
      const write = url.pathname === '/probe';
      if (write && started) return new Response(null, { status: 409, headers });
      if (write) started = true;
      let phase = 'head-bucket';
      let reader;
      try {
        const storage = getStorage();
        if (storage.bucket !== bucket) throw Error();
        const signal = AbortSignal.timeout(30_000);
        const options = { abortSignal: signal };
        await storage.client.send(
          new HeadBucketCommand({ Bucket: bucket }),
          options,
        );
        if (!write)
          return Response.json({ ok: true, injected: true }, { headers });

        const key = `__sortex_smoke__/${env.SORTEX_STORAGE_PROBE_ID}.png`;
        phase = 'head-object';
        reader = newReader();
        try {
          await reader.send(
            new HeadObjectCommand({ Bucket: bucket, Key: key }),
            options,
          );
          // Never overwrite an object that already exists, even if it looks synthetic.
          return Response.json({ ok: false, phase }, { status: 409, headers });
        } catch (error) {
          if (error?.$metadata?.httpStatusCode !== 404) throw error;
        }
        phase = 'put';
        await storage.client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: fixture,
            ContentType: 'image/png',
            CacheControl: 'private, no-store',
            IfNoneMatch: '*',
          }),
          options,
        );
        phase = 'get';
        const file = await reader.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
          options,
        );
        if (
          file.ContentLength !== fixture.length ||
          file.ContentType !== 'image/png' ||
          !file.Body
        ) {
          file.Body?.destroy?.();
          throw Error();
        }
        const bytes = Buffer.from(await file.Body.transformToByteArray());
        if (!bytes.equals(fixture) || digest(bytes) !== digest(fixture))
          throw Error();
        phase = 'anonymous';
        const anonymous = await request(`${endpoint}/${bucket}/${key}`, {
          method: 'GET',
          credentials: 'omit',
          redirect: 'error',
          headers: { 'Cache-Control': 'no-store' },
          signal,
        });
        await anonymous.body?.cancel();
        if (![401, 403].includes(anonymous.status)) throw Error();
        return Response.json(
          {
            ok: true,
            bytes: bytes.length,
            sha256: digest(bytes),
            anonymousDenied: true,
          },
          { headers },
        );
      } catch {
        return Response.json({ ok: false, phase }, { status: 503, headers });
      } finally {
        reader?.destroy?.();
      }
    },
  };
}
export default createHandler();
