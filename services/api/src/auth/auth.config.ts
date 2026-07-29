const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_PASSWORD_RESET_TTL_SECONDS = 60 * 60;

function requiredSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET') {
  const value = process.env[name];

  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} deve ser configurado em produção.`);
  }

  return `sortex-development-only-${name.toLowerCase()}`;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const authConfig = {
  accessSecret: () => requiredSecret('JWT_ACCESS_SECRET'),
  refreshSecret: () => requiredSecret('JWT_REFRESH_SECRET'),
  accessTokenTtlSeconds: () =>
    positiveInteger(
      process.env.JWT_ACCESS_TTL_SECONDS,
      DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    ),
  refreshTokenTtlSeconds: () =>
    positiveInteger(
      process.env.JWT_REFRESH_TTL_SECONDS,
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    ),
  passwordResetTtlSeconds: () =>
    positiveInteger(
      process.env.PASSWORD_RESET_TTL_SECONDS,
      DEFAULT_PASSWORD_RESET_TTL_SECONDS,
    ),
};
