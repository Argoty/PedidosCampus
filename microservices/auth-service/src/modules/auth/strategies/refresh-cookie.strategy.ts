import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { REFRESH_COOKIE_NAME } from '../../../common/constants/auth.constants';
import { AuthService } from '../auth.service';
import { RefreshRequestUser } from '../interfaces/auth.interfaces';

@Injectable()
export class RefreshCookieStrategy extends PassportStrategy(
  Strategy,
  'refresh-cookie',
) {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(request: Request): Promise<RefreshRequestUser> {
    // El refresh token solo se acepta desde cookie HttpOnly.
    const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME] as
      | string
      | undefined;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no enviado');
    }

    // Devuelve usuario autenticado por refresh y el id del token para rotation.
    return this.authService.validateRefreshToken(refreshToken);
  }
}
