/** Name of the HTTP-only cookie that carries the JWT access token. */
export const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Cookie lifetime in milliseconds. Keep this in sync with the JWT_EXPIRES_IN
 * environment variable (default: 1 day).
 */
export const ACCESS_TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 24;

/** Remember-me cookie lifetime (30 days). */
export const ACCESS_TOKEN_REMEMBER_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

/** Remember-me JWT lifetime override. */
export const ACCESS_TOKEN_REMEMBER_EXPIRES_IN = '30d';
