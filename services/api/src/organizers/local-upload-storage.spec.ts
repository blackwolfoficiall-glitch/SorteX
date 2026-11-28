import { access, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  initializeLocalUploadStorage,
  isLocalUploadStorageReady,
} from './local-upload-storage';

const keys = [
  'ORGANIZER_UPLOAD_DIR',
  'UPLOADS_DISABLED',
  'STORAGE_DRIVER',
  'APP_ENV',
  'NODE_ENV',
];

describe('local upload storage startup', () => {
  let previous: Map<string, string | undefined>;
  let directory: string;
  let root: string;

  beforeEach(async () => {
    previous = new Map(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];
    directory = await mkdtemp(join(tmpdir(), 'sortex-storage-startup-'));
    root = join(directory, 'uploads');
    process.env.ORGANIZER_UPLOAD_DIR = root;
    process.env.NODE_ENV = 'development';
  });

  afterEach(async () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(directory, { recursive: true, force: true });
  });

  it('creates a missing private directory in local development', async () => {
    await expect(isLocalUploadStorageReady()).resolves.toBe(false);
    await initializeLocalUploadStorage();
    await expect(isLocalUploadStorageReady()).resolves.toBe(true);
    expect((await stat(root)).mode & 0o777).toBe(0o700);
  });

  it.each([
    { UPLOADS_DISABLED: 'true' },
    { STORAGE_DRIVER: 'neon-s3' },
    { APP_ENV: 'staging', NODE_ENV: 'production' },
  ])('does not provision local files for %p', async (override) => {
    Object.assign(process.env, override);
    await initializeLocalUploadStorage();
    await expect(access(root)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not report a regular file as a usable upload directory', async () => {
    await writeFile(root, 'placeholder');
    await expect(isLocalUploadStorageReady()).resolves.toBe(false);
    await expect(initializeLocalUploadStorage()).rejects.toThrow(
      'Diretório de uploads indisponível para gravação.',
    );
  });

  it('requires an explicit absolute path when selecting the filesystem driver', async () => {
    process.env.STORAGE_DRIVER = 'filesystem';
    process.env.ORGANIZER_UPLOAD_DIR = 'relative/path';
    await expect(initializeLocalUploadStorage()).rejects.toThrow(
      'STORAGE_DRIVER=filesystem exige ORGANIZER_UPLOAD_DIR absoluto.',
    );
  });
});
