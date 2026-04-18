import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthRole, AuthUser } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_TTL_DAYS,
} from '../../common/constants/auth.constants';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AccessTokenPayload,
  AuthSession,
  AuthTokens,
  RefreshRequestUser,
  SafeAuthUser,
} from './interfaces/auth.interfaces';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthSession> {
    const normalizedEmail = registerDto.email.trim().toLowerCase();

    const existingUser = await this.prisma.authUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new BadRequestException('El correo ya esta registrado');
    }

    const passwordHash = await bcrypt.hash(
      registerDto.password,
      this.getSaltRounds(),
    );

    const user = await this.prisma.authUser.create({
      data: {
        nombre: registerDto.nombre.trim(),
        email: normalizedEmail,
        passwordHash,
        role: registerDto.role ?? AuthRole.usuario,
      },
    });

    // Registro y login comparten la misma creacion de sesion.
    return this.createSession(user);
  }

  async login(user: SafeAuthUser): Promise<AuthSession> {
    if (!user.isActive) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    return this.createSession(user);
  }

  async validateUserCredentials(loginDto: LoginDto): Promise<SafeAuthUser> {
    const normalizedEmail = loginDto.email.trim().toLowerCase();

    const user = await this.prisma.authUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    return this.sanitizeUser(user);
  }

  async validateRefreshToken(refreshToken: string): Promise<RefreshRequestUser> {
    // Nunca se consulta por token plano, siempre por hash.
    const tokenHash = this.hashToken(refreshToken);

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    // Si un refresh ya revocado vuelve a usarse, se asume posible robo/replay.
    if (tokenRecord.revokedAt) {
      // Reuse detection: token revocado reutilizado -> cerrar todas las sesiones del usuario.
      await this.revokeAllActiveRefreshTokens(tokenRecord.userId);
      throw new UnauthorizedException('Sesion comprometida. Inicia sesion de nuevo');
    }

    if (tokenRecord.expiresAt <= new Date()) {
      // Si expiro, se marca revocado para impedir cualquier reutilizacion posterior.
      await this.revokeRefreshTokenById(tokenRecord.id);
      throw new UnauthorizedException('Refresh token expirado');
    }

    if (!tokenRecord.user.isActive) {
      await this.revokeAllActiveRefreshTokens(tokenRecord.userId);
      throw new UnauthorizedException('Usuario no autorizado');
    }

    return {
      userId: tokenRecord.user.id,
      email: tokenRecord.user.email,
      role: tokenRecord.user.role,
      refreshToken,
      refreshTokenId: tokenRecord.id,
    };
  }

  async refreshTokens(user: RefreshRequestUser): Promise<AuthSession> {
    const userRecord = await this.prisma.authUser.findUnique({
      where: { id: user.userId },
    });

    if (!userRecord || !userRecord.isActive) {
      await this.revokeAllActiveRefreshTokens(user.userId);
      throw new UnauthorizedException('Usuario no autorizado');
    }

    const tokens = await this.generateTokens(
      userRecord.id,
      userRecord.email,
      userRecord.role,
    );

    const now = new Date();
    // Operacion atomica: revoca el token usado y crea el siguiente refresh.
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: user.refreshTokenId },
        data: {
          revokedAt: now,
          lastUsedAt: now,
        },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: userRecord.id,
          tokenHash: this.hashToken(tokens.refreshToken),
          expiresAt: this.getRefreshTokenExpiryDate(),
        },
      }),
    ]);

    return {
      user: this.sanitizeUser(userRecord),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logoutByRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
      },
    });

    if (!tokenRecord) {
      // Logout idempotente: si no existe token activo, no falla.
      return;
    }

    await this.revokeRefreshTokenById(tokenRecord.id);
  }

  async getProfile(userId: string): Promise<SafeAuthUser> {
    const user = await this.prisma.authUser.findUnique({ where: { id: userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return this.sanitizeUser(user);
  }

  private async createSession(user: AuthUser | SafeAuthUser): Promise<AuthSession> {
    const safeUser = this.sanitizeUser(user);
    const tokens = await this.generateTokens(
      safeUser.id,
      safeUser.email,
      safeUser.role,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: safeUser.id,
        tokenHash: this.hashToken(tokens.refreshToken),
        expiresAt: this.getRefreshTokenExpiryDate(),
      },
    });

    return {
      user: safeUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: AuthRole,
  ): Promise<AuthTokens & { refreshToken: string }> {
    const accessPayload: AccessTokenPayload = {
      sub: userId,
      email,
      role,
      type: 'access',
      jti: randomUUID(),
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.getAccessTokenSecret(),
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    // Refresh opaco: no se firma ni se puede decodificar como JWT.
    const refreshToken = randomBytes(64).toString('base64url');

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: AuthUser | SafeAuthUser): SafeAuthUser {
    if ('passwordHash' in user) {
      const { passwordHash: _passwordHash, ...safeUser } = user;
      return safeUser;
    }

    return user;
  }

  private hashToken(token: string): string {
    // Solo persistimos hash en BD para no almacenar refresh tokens en texto plano.
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiryDate(): Date {
    // Mantiene una sola fuente de verdad para expiracion de refresh.
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
    return expiresAt;
  }

  private async revokeRefreshTokenById(refreshTokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: refreshTokenId },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeAllActiveRefreshTokens(userId: string): Promise<void> {
    // Corte global de sesiones del usuario (reuse detection o usuario inactivo).
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private getSaltRounds(): number {
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);

    if (Number.isNaN(saltRounds) || saltRounds < 8) {
      return 10;
    }

    return saltRounds;
  }

  private getAccessTokenSecret(): string {
    return process.env.ACCESS_TOKEN_SECRET ?? 'dev_access_secret_change_me';
  }
}
