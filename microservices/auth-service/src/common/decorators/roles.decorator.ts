import { SetMetadata } from '@nestjs/common';
import { AuthRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
// Escribe metadata de roles para que RolesGuard la valide en runtime.
export const Roles = (...roles: AuthRole[]) => SetMetadata(ROLES_KEY, roles);
