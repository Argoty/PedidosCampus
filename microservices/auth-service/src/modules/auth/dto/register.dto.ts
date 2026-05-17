import { IsEmail, IsOptional, IsString, IsEnum, MinLength } from 'class-validator';

export enum RegisterRole {
  usuario = 'usuario',
  repartidor = 'repartidor',
}

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
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsEnum(RegisterRole)
  role?: RegisterRole = RegisterRole.usuario;

  // NOTE: Solo se acepta "usuario" o "repartidor". "admin" NUNCA en registro.
  // Para crear admins: usar migrations o admin API (futuro).
}
