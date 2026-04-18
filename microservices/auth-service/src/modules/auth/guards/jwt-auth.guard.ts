import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
// Enruta la autenticacion al strategy "jwt" (access token).
export class JwtAuthGuard extends AuthGuard('jwt') {}
