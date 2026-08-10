import SecurityHelper from "../helpers/security.js";
import {WHITELIST} from "../constants/security.js";
import {isDevMode} from "../helpers/utils.js";

export const checkJwt = (req, res, next) => {

    if (isDevMode()) {
        console.log(Date.now(), req.originalUrl, req.query, req.cookies);
    }
    if (WHITELIST.some((url) => req.originalUrl.startsWith(url))) {
        return next();
    }
    const accessToken = req.cookies["access_token"];

    if (!accessToken) {
        return res.status(401).json({"message": "Utilisateur non connecté"});
    }

    try {
        const jwt = SecurityHelper.verifyJwt(accessToken, process.env.JWT_SECRET);
        req.userId = jwt.sub;
    } catch (e) {
        return res.status(403).json({"message": e.message});
    }
    next();
}