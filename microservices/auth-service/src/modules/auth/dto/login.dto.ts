import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  // class-validator valida el body automaticamente por ValidationPipe global.
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
