const { verifyJwt } = require('../helpers/security');

const checkJwt = (req, res, next) => {
    const token = req.cookies[process.env.COOKIE];
   
    if (token === null) {
        return res.status(401).json({ 'message': 'Utilisateur non connecté' });
    }

    try {
        const json = verifyJwt(token, process.env.JWT_SECRET);
        req.user = { id: json.id, email: json.email, name: json.name };
    } catch (_) {
        return res.status(403).json({ 'message': 'Utilisateur non autorisé' });
    }
    next();
}

module.exports = { checkJwt };