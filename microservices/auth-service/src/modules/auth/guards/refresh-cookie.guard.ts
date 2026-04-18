import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class RefreshCookieGuard extends AuthGuard('refresh-cookie') {}
