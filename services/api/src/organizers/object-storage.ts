import { S3Client } from '@aws-sdk/client-s3';

let client: S3Client | undefined;

export function usesObjectStorage() {
  return process.env.STORAGE_DRIVER === 'neon-s3';
}

export function objectStorage() {
  const bucket = process.env.STORAGE_BUCKET;
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  if (!bucket || !endpoint)
    throw new Error('Armazenamento privado não configurado.');
  if (new URL(endpoint).protocol !== 'https:')
    throw new Error('Armazenamento remoto exige HTTPS.');
  if (!client) client = new S3Client({ endpoint, forcePathStyle: true });
  return { client, bucket };
}
