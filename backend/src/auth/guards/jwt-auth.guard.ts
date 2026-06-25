import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects routes using the JWT extracted from the HTTP-only cookie.
 * Delegates to the `jwt` Passport strategy (see JwtStrategy).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
