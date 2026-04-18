import { AuthRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  // Si no llega role, AuthService asigna "usuario" por defecto.
  @IsEnum(AuthRole)
  role?: AuthRole;
}
