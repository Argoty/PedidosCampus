import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { SafeAuthUser } from '../interfaces/auth.interfaces';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    // Passport-local usa "username" por defecto; aqui autenticamos por email.
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string): Promise<SafeAuthUser> {
    return this.authService.validateUserCredentials({ email, password });
  }
}
