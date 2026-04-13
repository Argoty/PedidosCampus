import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthRole, AuthUser, RefreshToken } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from '../../common/constants/auth.constants';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AuthResponse,
  AuthTokens,
  JwtTokenPayload,
  SafeAuthUser,
} from './interfaces/auth.interfaces';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
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

    return this.createSession(user);
  }

  async login(user: SafeAuthUser): Promise<AuthResponse> {
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

  async refreshTokens(
    userId: string,
    currentRefreshToken: string,
  ): Promise<AuthResponse> {
    const user = await this.prisma.authUser.findUnique({ where: { id: userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no autorizado');
    }

    const tokenRecord = await this.validateStoredRefreshToken(
      userId,
      currentRefreshToken,
    );

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: now, lastUsedAt: now },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(tokens.refreshToken),
          expiresAt: this.getRefreshTokenExpiryDate(),
        },
      }),
    ]);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: {
        userId,
        tokenHash,
        revokedAt: null,
      },
    });

    if (!tokenRecord) {
      return;
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string): Promise<SafeAuthUser> {
    const user = await this.prisma.authUser.findUnique({ where: { id: userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return this.sanitizeUser(user);
  }

  private async createSession(
    user: AuthUser | SafeAuthUser,
  ): Promise<AuthResponse> {
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
      ...tokens,
    };
  }

  private async validateStoredRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<RefreshToken> {
    const tokenHash = this.hashToken(refreshToken);

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: {
        userId,
        tokenHash,
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    if (tokenRecord.revokedAt) {
      throw new UnauthorizedException('Refresh token revocado');
    }

    if (tokenRecord.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    return tokenRecord;
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: AuthRole,
  ): Promise<AuthTokens> {
    const refreshJti = randomUUID();

    const accessPayload: JwtTokenPayload = {
      sub: userId,
      email,
      role,
      type: 'access',
      jti: randomUUID(),
    };

    const refreshPayload: JwtTokenPayload = {
      sub: userId,
      email,
      role,
      type: 'refresh',
      jti: refreshJti,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.getAccessTokenSecret(),
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.getRefreshTokenSecret(),
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      }),
    ]);

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
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiryDate(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return expiresAt;
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

  private getRefreshTokenSecret(): string {
    return process.env.REFRESH_TOKEN_SECRET ?? 'dev_refresh_secret_change_me';
  }
}
