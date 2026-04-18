import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
// Ejecuta LocalStrategy para login (email/password).
export class LocalAuthGuard extends AuthGuard('local') {}
