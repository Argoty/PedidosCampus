import { AuthRole, AuthUser } from '@prisma/client';

// Usuario seguro para respuestas API (nunca expone passwordHash).
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
  // Solo para uso interno del backend; sale por cookie, no por JSON.
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
  // Token opaco leido desde cookie HttpOnly.
  refreshToken: string;
  // Id de fila en BD para aplicar rotation de forma atomica.
  refreshTokenId: string;
}
