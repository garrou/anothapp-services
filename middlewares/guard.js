const { verifyJwt } = require("../helpers/security");

const checkJwt = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const [type, token] = authHeader && authHeader.split(" ");
    
    if (type !== "Bearer" || token === null) {
        return res.status(401).json({ "message": "Utilisateur non connecté" });
    }

    try {
        req.user = { id: verifyJwt(token, process.env.JWT_SECRET) };
    } catch (_) {
        return res.status(403).json({ "message": "Utilisateur non autorisé" });
    }
    next();
}

module.exports = { checkJwt };