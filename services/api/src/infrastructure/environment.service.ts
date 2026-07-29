import { Injectable } from '@nestjs/common';
@Injectable()
export class EnvironmentService {
  readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  readonly production = this.nodeEnv === 'production';
  get(name: string, fallback?: string) {
    const value = process.env[name] ?? fallback;
    if (value === undefined)
      throw new Error(`Variável obrigatória ausente: ${name}`);
    return value;
  }
  validate() {
    const required = [
      'DATABASE_URL',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
    ];
    if (this.production) required.push('WEB_URL', 'APP_URL', 'API_URL');
    for (const key of required) {
      const value = process.env[key];
      if (
        !value ||
        value.startsWith('replace-with') ||
        value.includes('development-only')
      )
        throw new Error(
          `${key} deve ser configurada com valor seguro em ${this.nodeEnv}.`,
        );
    }
    const origins = this.allowedOrigins();
    if (
      this.production &&
      origins.some((x) => x === '*' || x.includes('localhost'))
    )
      throw new Error(
        'CORS_ALLOWED_ORIGINS contém origem insegura para produção.',
      );
    return true;
  }
  allowedOrigins() {
    return (
      process.env.CORS_ALLOWED_ORIGINS ??
      process.env.WEB_URL ??
      'http://localhost:3000'
    )
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }
}
