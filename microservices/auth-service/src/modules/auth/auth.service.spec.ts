import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthRole, AuthUser } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;

  const prismaMock = {
    authUser: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const jwtServiceMock = {
    signAsync: jest.fn(),
  } as unknown as JwtService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(prismaMock, jwtServiceMock);
  });

  it('debe registrar un usuario y retornar tokens', async () => {
    const createdUser: AuthUser = {
      id: '1f2504e0-4f89-41d3-9a0c-0305e82c3301',
      nombre: 'Leonardo',
      email: 'leo@campus.edu',
      passwordHash: 'hashed_password',
      role: AuthRole.usuario,
      isActive: true,
      createdAt: new Date('2026-04-10T00:00:00.000Z'),
      updatedAt: new Date('2026-04-10T00:00:00.000Z'),
    };

    prismaMock.authUser.findUnique = jest.fn().mockResolvedValue(null);
    prismaMock.authUser.create = jest.fn().mockResolvedValue(createdUser);
    prismaMock.refreshToken.create = jest.fn().mockResolvedValue({ id: 'token-1' });
    (jwtServiceMock.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_password' as never);

    const result = await authService.register({
      nombre: 'Leonardo',
      email: 'leo@campus.edu',
      password: 'secret123',
    });

    expect((result.user as Partial<AuthUser>).passwordHash).toBeUndefined();
    expect(result.user.email).toBe('leo@campus.edu');
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('debe fallar si el correo ya existe', async () => {
    prismaMock.authUser.findUnique = jest.fn().mockResolvedValue({ id: 'exists' });

    await expect(
      authService.register({
        nombre: 'Leonardo',
        email: 'leo@campus.edu',
        password: 'secret123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('debe validar credenciales y retornar usuario seguro', async () => {
    const user: AuthUser = {
      id: '1f2504e0-4f89-41d3-9a0c-0305e82c3301',
      nombre: 'Leonardo',
      email: 'leo@campus.edu',
      passwordHash: 'hash_db',
      role: AuthRole.admin,
      isActive: true,
      createdAt: new Date('2026-04-10T00:00:00.000Z'),
      updatedAt: new Date('2026-04-10T00:00:00.000Z'),
    };

    prismaMock.authUser.findUnique = jest.fn().mockResolvedValue(user);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const result = await authService.validateUserCredentials({
      email: 'leo@campus.edu',
      password: 'secret123',
    });

    expect(result.id).toBe(user.id);
    expect((result as Partial<AuthUser>).passwordHash).toBeUndefined();
  });

  it('debe rechazar credenciales invalidas', async () => {
    const user: AuthUser = {
      id: '1f2504e0-4f89-41d3-9a0c-0305e82c3301',
      nombre: 'Leonardo',
      email: 'leo@campus.edu',
      passwordHash: 'hash_db',
      role: AuthRole.usuario,
      isActive: true,
      createdAt: new Date('2026-04-10T00:00:00.000Z'),
      updatedAt: new Date('2026-04-10T00:00:00.000Z'),
    };

    prismaMock.authUser.findUnique = jest.fn().mockResolvedValue(user);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    await expect(
      authService.validateUserCredentials({
        email: 'leo@campus.edu',
        password: 'wrong',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
