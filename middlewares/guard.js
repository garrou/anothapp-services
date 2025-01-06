import { verifyJwt } from "../helpers/security.js";

const WHITELIST = [
    "/auth/login",
    "/auth/register",
    "/search/images",
];

export const checkJwt = (req, res, next) => {

    if (WHITELIST.some((url) => req.originalUrl.startsWith(url))) {
        return next();
    }
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(400).json({ "message": "Requête invalide" });
    }
    const [type, token] = authHeader.split(" ");

    if (type !== "Bearer" || !token) {
        return res.status(401).json({ "message": "Utilisateur non connecté" });
    } 

    try {
        req.userId = verifyJwt(token, process.env.JWT_SECRET);
    } catch (e) {
        return res.status(403).json({ "message": "Utilisateur non autorisé" });
    }
    next();
}