import { BadRequestException } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrganizerStorageService } from './organizer-storage.service';

describe('OrganizerStorageService', () => {
  const previousUploadDirectory = process.env.ORGANIZER_UPLOAD_DIR;
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sortex-organizer-storage-'));
    process.env.ORGANIZER_UPLOAD_DIR = directory;
  });

  afterEach(async () => {
    if (previousUploadDirectory === undefined)
      delete process.env.ORGANIZER_UPLOAD_DIR;
    else process.env.ORGANIZER_UPLOAD_DIR = previousUploadDirectory;
    await rm(directory, { recursive: true, force: true });
  });

  it.each([
    [
      'image/png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xdb])],
    ['image/webp', Buffer.from('RIFF0000WEBP', 'ascii')],
  ])('persiste arquivo %s com assinatura válida', async (mimetype, buffer) => {
    const service = new OrganizerStorageService();
    await expect(
      service.save('organizer-test', {
        buffer,
        mimetype,
        originalname: 'logo',
        size: buffer.length,
      }),
    ).resolves.toMatchObject({ mimeType: mimetype });
  });

  it('rejeita PNG corrompido antes de persistir', async () => {
    const service = new OrganizerStorageService();
    const buffer = Buffer.from('\uFFFDPNG\r\n\u001a\n', 'utf8');
    await expect(
      service.save('organizer-test', {
        buffer,
        mimetype: 'image/png',
        originalname: 'logo.png',
        size: buffer.length,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
