import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
// Ejecuta strategy "refresh-cookie" para endpoints refresh/logout.
export class RefreshCookieGuard extends AuthGuard('refresh-cookie') {}
