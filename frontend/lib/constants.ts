/**
 * Frontend mirrors of backend contract constants.
 * Source of truth: backend/src/auth/auth.constants.ts.
 */

/** HTTP-only cookie carrying the JWT access token. Middleware checks its presence. */
export const ACCESS_TOKEN_COOKIE = "access_token";
