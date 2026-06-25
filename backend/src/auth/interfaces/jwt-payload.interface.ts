import { Role } from '../../generated/prisma/enums';

/** Decoded payload stored inside the signed JWT. */
export interface JwtPayload {
  /** Subject — the user's id. */
  sub: string;
  /** The user's role, used for RBAC. */
  role: Role;
}

/** Authenticated principal attached to `req.user` after JwtStrategy validation. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
}
