import { AuthRole, AuthUser } from '@prisma/client';

export type SafeAuthUser = Omit<AuthUser, 'passwordHash'>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: SafeAuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface JwtTokenPayload {
  sub: string;
  email: string;
  role: AuthRole;
  type: 'access' | 'refresh';
  jti: string;
}

export interface JwtRequestUser {
  userId: string;
  email: string;
  role: AuthRole;
  tokenType: 'access' | 'refresh';
  refreshToken?: string;
}
