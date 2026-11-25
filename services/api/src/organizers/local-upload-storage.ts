import { constants } from 'node:fs';
import { access, mkdir, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { usesObjectStorage } from './object-storage';

export function localUploadRoot() {
  return resolve(
    process.env.ORGANIZER_UPLOAD_DIR?.trim() || './storage/organizers',
  );
}

export async function initializeLocalUploadStorage() {
  if (process.env.UPLOADS_DISABLED === 'true' || usesObjectStorage()) return;
  const explicitFilesystem = process.env.STORAGE_DRIVER === 'filesystem';
  const localDevelopment =
    ['development', 'test'].includes(process.env.NODE_ENV || 'development') &&
    ['', 'development', 'test'].includes(process.env.APP_ENV || '');
  if (!explicitFilesystem && !localDevelopment) return;
  if (
    explicitFilesystem &&
    !isAbsolute(process.env.ORGANIZER_UPLOAD_DIR?.trim() ?? '')
  ) {
    throw new Error(
      'STORAGE_DRIVER=filesystem exige ORGANIZER_UPLOAD_DIR absoluto.',
    );
  }
  try {
    const directory = localUploadRoot();
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (!(await isLocalUploadStorageReady())) throw new Error();
  } catch {
    throw new Error('Diretório de uploads indisponível para gravação.');
  }
}

export async function isLocalUploadStorageReady() {
  try {
    const directory = localUploadRoot();
    if (!(await stat(directory)).isDirectory()) return false;
    await access(directory, constants.R_OK | constants.W_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
