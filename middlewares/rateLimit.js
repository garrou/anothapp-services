import { rateLimit } from 'express-rate-limit'

export const limiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 100,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	ipv6Subnet: 56,
    handler: (req, res) => {
        res.status(429).json({ message: "Too many requests, please try again later." });
    },
});

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56,
    skipSuccessfulRequests: true,
    handler: (req, res) => {
        res.status(429).json({ message: "Too many login attempts, please try again later." });
    },
});