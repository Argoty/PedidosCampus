import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { Response } from 'express';
import {
  REFRESH_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
} from '../../common/constants/auth.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshCookieGuard } from './guards/refresh-cookie.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import {
  AuthResponse,
  AuthenticatedUser,
  RefreshRequestUser,
  SafeAuthUser,
} from './interfaces/auth.interfaces';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    // Flujo de registro: crear usuario + abrir sesion inicial (access + refresh cookie).
    const session = await this.authService.register(registerDto);

    this.setRefreshCookie(response, session.refreshToken);
    return {
      user: session.user,
      accessToken: session.accessToken,
    };
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() _loginDto: LoginDto,
    @CurrentUser() user: SafeAuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    // LocalAuthGuard ya valido credenciales y cargo request.user.
    const session = await this.authService.login(user);

    this.setRefreshCookie(response, session.refreshToken);
    return {
      user: session.user,
      accessToken: session.accessToken,
    };
  }

  @Post('refresh')
  @UseGuards(RefreshCookieGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() user: RefreshRequestUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    // Rotation: invalida refresh anterior y emite uno nuevo.
    const session = await this.authService.refreshTokens(user);

    this.setRefreshCookie(response, session.refreshToken);
    return {
      user: session.user,
      accessToken: session.accessToken,
    };
  }

  @Post('logout')
  @UseGuards(RefreshCookieGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: RefreshRequestUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    // Revoca el refresh activo de la cookie actual.
    await this.authService.logoutByRefreshToken(user.refreshToken);
    this.clearRefreshCookie(response);

    return { message: 'Sesion cerrada correctamente' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser): Promise<SafeAuthUser> {
    return this.authService.getProfile(user.userId);
  }

  @Get('admin/ping')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AuthRole.admin)
  pingAdmin(): { message: string } {
    return { message: 'Acceso admin concedido' };
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    // Cookie HttpOnly: evita que JS del navegador lea el refresh token.
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: this.isSecureCookie(),
      sameSite: 'strict',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: REFRESH_COOKIE_PATH,
    });
  }

  private clearRefreshCookie(response: Response): void {
    // Limpieza explicita para logout seguro en cliente.
    response.cookie(REFRESH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: this.isSecureCookie(),
      sameSite: 'strict',
      maxAge: 0,
      path: REFRESH_COOKIE_PATH,
    });
  }

  private isSecureCookie(): boolean {
    // En local HTTP usar false; en produccion HTTPS debe ser true.
    return (process.env.COOKIE_SECURE ?? 'true').toLowerCase() === 'true';
  }
}
