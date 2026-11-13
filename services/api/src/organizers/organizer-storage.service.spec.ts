import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrganizerStorageService } from './organizer-storage.service';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

describe('OrganizerStorageService', () => {
  const previousUploadDirectory = process.env.ORGANIZER_UPLOAD_DIR;
  const previousUploadsDisabled = process.env.UPLOADS_DISABLED;
  const previousDriver = process.env.STORAGE_DRIVER;
  const previousBucket = process.env.STORAGE_BUCKET;
  const previousEndpoint = process.env.AWS_ENDPOINT_URL_S3;
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sortex-organizer-storage-'));
    process.env.ORGANIZER_UPLOAD_DIR = directory;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    for (const [key, value] of Object.entries({
      STORAGE_DRIVER: previousDriver,
      STORAGE_BUCKET: previousBucket,
      AWS_ENDPOINT_URL_S3: previousEndpoint,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (previousUploadsDisabled === undefined)
      delete process.env.UPLOADS_DISABLED;
    else process.env.UPLOADS_DISABLED = previousUploadsDisabled;
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

  it('recusa upload quando armazenamento durável não está configurado', async () => {
    process.env.UPLOADS_DISABLED = 'true';
    await expect(
      new OrganizerStorageService().save('organizer-test'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
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

  it('preserva o conteúdo ao abrir um arquivo do backend local', async () => {
    const service = new OrganizerStorageService();
    const buffer = Buffer.from('%PDF-1.4 teste');
    const saved = await service.save('local-test', {
      buffer,
      mimetype: 'application/pdf',
      originalname: 'teste.pdf',
      size: buffer.length,
    });
    const chunks: Buffer[] = [];
    for await (const chunk of await service.open(saved.storageKey))
      chunks.push(Buffer.from(chunk as Uint8Array));
    expect(Buffer.concat(chunks)).toEqual(buffer);
  });

  it('usa bucket privado sem sobrescrita e devolve o stream original no backend remoto', async () => {
    process.env.STORAGE_DRIVER = 'neon-s3';
    process.env.STORAGE_BUCKET = 'test-private';
    process.env.AWS_ENDPOINT_URL_S3 = 'https://storage.example.invalid';
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const service = new OrganizerStorageService();
    const buffer = Buffer.from('%PDF-1.4 teste');
    const saved = await service.save('remote-test', {
      buffer,
      mimetype: 'application/pdf',
      originalname: 'teste.pdf',
      size: buffer.length,
    });
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'test-private',
      Key: saved.storageKey,
      IfNoneMatch: '*',
      Body: buffer,
    });
    const stream = Readable.from([buffer]);
    send.mockResolvedValue({ Body: stream } as never);
    expect(await service.open(saved.storageKey)).toBe(stream);
    expect(send.mock.calls[1][0]).toBeInstanceOf(GetObjectCommand);
  });

  it.each([
    '../private.env',
    'campaigns/../private.env',
    '/absolute/file',
    'campaigns\\private.env',
  ])(
    'recusa chave inválida %s antes de acessar qualquer backend',
    async (key) => {
      const send = jest.spyOn(S3Client.prototype, 'send');
      await expect(
        new OrganizerStorageService().open(key),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(send).not.toHaveBeenCalled();
    },
  );
});
