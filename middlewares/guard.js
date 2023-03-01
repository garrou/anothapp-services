const { verifyJwt } = require('../helpers/security');
const config = require('../config/config.json');

const checkJwt = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const [type, token] = authHeader && authHeader.split(' ');
    
    if (type !== 'Bearer' || token === null) {
        return res.status(401).json({ 'message': 'Utilisateur non connecté' });
    }

    try {
        req.user = { id: verifyJwt(token, config.JWT_SECRET) };
    } catch (_) {
        return res.status(403).json({ 'message': 'Utilisateur non autorisé' });
    }
    next();
}

module.exports = { checkJwt };