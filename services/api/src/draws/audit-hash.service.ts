import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

@Injectable()
export class AuditHashService {
  readonly algorithmVersion = 'sortex-draw-v1';
  create(payload: unknown) {
    return createHash('sha256')
      .update(
        this.canonical({ algorithmVersion: this.algorithmVersion, payload }),
      )
      .digest('hex');
  }
  private canonical(value: unknown): string {
    if (value === null || typeof value !== 'object')
      return JSON.stringify(value);
    if (Array.isArray(value))
      return `[${value.map((item) => this.canonical(item)).join(',')}]`;
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${this.canonical(val)}`)
      .join(',')}}`;
  }
}
