import { rateLimit, ipKeyGenerator } from 'express-rate-limit'

const WINDOW_15_MIN = 15 * 60 * 1000;
const WINDOW_24_HOURS = 24 * 60 * 60 * 1000;

/**
 * @param {{limit: number, message: string, windowMs?: number, skipSuccessfulRequests?: boolean, byUser?: boolean}} options
 * @returns {import('express-rate-limit').RateLimitRequestHandler}
 */
const createLimiter = ({ limit, message, windowMs = WINDOW_15_MIN, skipSuccessfulRequests = false, byUser = false }) => rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests,
    ...(byUser ? { keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip) } : { ipv6Subnet: 56 }),
    handler: (req, res) => {
        res.status(429).json({ message });
    },
});

export const limiter = createLimiter({
    limit: 2500, message: "Too many requests, please try again later.",
});

// skipSuccessfulRequests is deliberately NOT set here: a correct password now always returns a
// 200 (pendingApproval), never a session directly, so without this every attempt with a known
// password would be free to spam-trigger login-code emails to the victim
export const loginLimiter = createLimiter({
    limit: 5, message: "Too many login attempts, please try again later.",
});

// separate from loginLimiter since it's brute-forcing a 6-digit code, not a password
export const confirmLoginLimiter = createLimiter({
    limit: 10, message: "Too many attempts, please try again later.",
});

export const registerLimiter = createLimiter({
    limit: 5, message: "Too many registration attempts, please try again later.",
});

export const refreshLimiter = createLimiter({
    limit: 20, message: "Too many refresh attempts, please try again later.", skipSuccessfulRequests: true,
});

export const logoutLimiter = createLimiter({
    limit: 20, message: "Too many requests, please try again later.",
});

export const cancelDeletionLimiter = createLimiter({
    limit: 5, message: "Too many attempts, please try again later.",
});

export const exportLimiter = createLimiter({
    limit: 5, message: "Too many export requests, please try again later.", windowMs: WINDOW_24_HOURS, byUser: true,
});

export const importLimiter = createLimiter({
    limit: 5, message: "Too many import requests, please try again later.", windowMs: WINDOW_24_HOURS, byUser: true,
});

export const verifyEmailLimiter = createLimiter({
    limit: 10, message: "Too many attempts, please try again later.",
});

export const forgotPasswordLimiter = createLimiter({
    limit: 3, message: "Too many attempts, please try again later.",
});

export const resetPasswordLimiter = createLimiter({
    limit: 5, message: "Too many attempts, please try again later.",
});

export const requestDeletionLimiter = createLimiter({
    limit: 5, message: "Too many attempts, please try again later.", byUser: true,
});
