import { AuthRole, AuthUser } from '@prisma/client';

export type SafeAuthUser = Omit<AuthUser, 'passwordHash'>;

export interface AuthTokens {
  accessToken: string;
}

export interface AuthResponse {
  user: SafeAuthUser;
  accessToken: string;
}

export interface AuthSession {
  user: SafeAuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: AuthRole;
  type: 'access';
  jti: string;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: AuthRole;
}

export interface RefreshRequestUser extends AuthenticatedUser {
  refreshToken: string;
  refreshTokenId: string;
}
