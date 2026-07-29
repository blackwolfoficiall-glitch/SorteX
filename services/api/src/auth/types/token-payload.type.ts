import { UserRole } from '@prisma/client';

type BaseTokenPayload = {
  sub: string;
  sid: string;
  role: UserRole;
};

export type AccessTokenPayload = BaseTokenPayload & { type: 'access' };
export type RefreshTokenPayload = BaseTokenPayload & { type: 'refresh' };
