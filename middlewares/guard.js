import SecurityHelper from "../helpers/security.js";
import {ERROR_INVALID_REQUEST} from "../constants/errors.js";
import {WHITELIST} from "../constants/security.js";
import {isDevMode} from "../helpers/utils.js";

export const checkJwt = (req, res, next) => {

    if (isDevMode()) {
        console.log(Date.now(), req.originalUrl, req.query);
    }
    if (WHITELIST.some((url) => req.originalUrl.startsWith(url))) {
        return next();
    }
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(400).json({"message": ERROR_INVALID_REQUEST});
    }
    const [type, token] = authHeader.split(" ");

    if (type !== "Bearer" || !token) {
        return res.status(401).json({"message": "Utilisateur non connecté"});
    }

    try {
        req.userId = SecurityHelper.verifyJwt(token, process.env.JWT_SECRET);
    } catch (e) {
        return res.status(403).json({"message": "Utilisateur non autorisé"});
    }
    next();
}