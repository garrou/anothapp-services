export const WHITELIST = [
    "/auth/login",
    "/auth/confirm-login",
    "/auth/register",
    "/auth/refresh",
    "/auth/logout",
    "/auth/cancel-deletion",
    "/auth/verify-email",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/search/images",
];

export const DUMMY_HASH = "$2b$10$YeS4yVubIvktPkadn889L.KbxelCfmh/z2b9Vrc/vHZzxB/euZUgK";

// beyond this many wrong guesses, a login challenge is locked out - a fresh login() is needed
// for a new one, even with the correct code (see AuthService.confirmLogin)
export const MAX_LOGIN_CODE_ATTEMPTS = 5;