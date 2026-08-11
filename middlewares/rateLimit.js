import { rateLimit, ipKeyGenerator } from 'express-rate-limit'

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

export const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56,
    handler: (req, res) => {
        res.status(429).json({ message: "Too many registration attempts, please try again later." });
    },
});

export const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56,
    skipSuccessfulRequests: true,
    handler: (req, res) => {
        res.status(429).json({ message: "Too many refresh attempts, please try again later." });
    },
});

export const logoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56,
    handler: (req, res) => {
        res.status(429).json({ message: "Too many requests, please try again later." });
    },
});

export const exportLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip),
    handler: (req, res) => {
        res.status(429).json({ message: "Too many export requests, please try again later." });
    },
});