import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { UploadedOrganizerFile } from './types/uploaded-file.type';

const allowedMimeTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

type StorageOptions = {
  maxSize?: number;
  allowedMimeTypes?: Record<string, string>;
};

@Injectable()
export class OrganizerStorageService {
  private readonly root = resolve(
    process.env.ORGANIZER_UPLOAD_DIR ??
      join(process.cwd(), 'storage', 'organizers'),
  );

  async save(
    profileId: string,
    file?: UploadedOrganizerFile,
    options: StorageOptions = {},
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Selecione um arquivo para upload.');
    }

    const mimeTypes = options.allowedMimeTypes ?? allowedMimeTypes;
    const extension = mimeTypes[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        'Formato inválido. Envie JPG, PNG, WEBP ou PDF.',
      );
    }
    if (!this.hasValidSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'A imagem enviada está corrompida ou não corresponde ao formato informado.',
      );
    }

    const maxSize = options.maxSize ?? 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(
        `O arquivo deve ter no máximo ${Math.round(maxSize / 1024 / 1024)} MB.`,
      );
    }

    const directory = join(this.root, profileId);
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(join(directory, filename), file.buffer, { flag: 'wx' });

    return {
      storageKey: `${profileId}/${filename}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  resolve(storageKey: string) {
    const path = resolve(this.root, storageKey);
    if (!path.startsWith(`${this.root}/`)) {
      throw new BadRequestException('Arquivo inválido.');
    }
    return path;
  }

  mimeType(storageKey: string) {
    const extension = storageKey.split('.').pop()?.toLowerCase();
    return (
      {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        pdf: 'application/pdf',
        mp4: 'video/mp4',
        webm: 'video/webm',
      }[extension ?? ''] ?? 'application/octet-stream'
    );
  }

  private hasValidSignature(buffer: Buffer, mimeType: string) {
    if (mimeType === 'image/png')
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (mimeType === 'image/jpeg')
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    if (mimeType === 'image/webp')
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    if (mimeType === 'application/pdf')
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    return true;
  }
}
