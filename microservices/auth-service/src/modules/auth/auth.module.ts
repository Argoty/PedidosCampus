import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshCookieStrategy } from './strategies/refresh-cookie.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [PassportModule, JwtModule.register({}), PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    // Estrategia de refresh basada en cookie HttpOnly (token opaco).
    RefreshCookieStrategy,
    RolesGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
