import { SetMetadata } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';

/** Metadata key under which the allowed roles are stored. */
export const ROLES_KEY = 'roles';

/**
 * Restrict a route (or whole controller) to the given roles.
 * Must be combined with `RolesGuard` (and `JwtAuthGuard` to populate the user).
 *
 * @example
 * @Roles(Role.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
