import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { REFRESH_COOKIE_NAME } from '../../../common/constants/auth.constants';
import { JwtRequestUser, JwtTokenPayload } from '../interfaces/auth.interfaces';

const extractRefreshToken = (request: Request): string | null => {
  if (!request) {
    return null;
  }

  const cookieToken = request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (cookieToken) {
    return cookieToken;
  }

  const authHeaderToken = ExtractJwt.fromAuthHeaderAsBearerToken()(request);
  return authHeaderToken || null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractRefreshToken]),
      passReqToCallback: true,
      ignoreExpiration: false,
      secretOrKey:
        process.env.REFRESH_TOKEN_SECRET ?? 'dev_refresh_secret_change_me',
    });
  }

  validate(request: Request, payload: JwtTokenPayload): JwtRequestUser {
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token invalido');
    }

    const refreshToken = extractRefreshToken(request);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no enviado');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      tokenType: payload.type,
      refreshToken,
    };
  }
}
