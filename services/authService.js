const config = require('../config/config.json');
const userRepository = require('../repositories/userRepository');
const { comparePassword, createHash, uuid, signJwt } = require('../helpers/security');

const register = async (req, res) => {
    try {
        const { email, password, confirm } = req.body;

        if (password != confirm) {
            return res.status(400).json({ 'message': 'Les mots de passe sont différents' });
        }
        if (password.length < 8) {
            return res.status(400).json({ 'message': 'Le mot de passe doit faire au moins 8 caractères' });
        }
        const resp = await userRepository.getUserByEmail(email);

        if (resp.rowCount === 1) {
            return res.status(409).json({ 'message': 'Un compte est déjà associé à cet email' });
        }
        const hash = await createHash(password);
        await userRepository.createUser(uuid(), email, hash);

        res.status(201).json({ 'message': 'Compte créé' });
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const resp = await userRepository.getUserByEmail(email);

        if (resp.rowCount === 0) {
            return res.status(400).json({ 'message': 'Email ou mot de passe incorrect' });
        }
        const same = await comparePassword(password, resp['rows'][0].password);

        if (!same) {
            return res.status(400).json({ 'message': 'Email ou mot de passe incorrect' });
        }
        const token = signJwt(resp['rows'][0].id, config.JWT_SECRET);
        res.status(200).json({ 'token': token });
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getUser = async (req, res) => {
    try {
        const resp = await userRepository.getUserById(req.user.id);

        if (resp.rowCount === 1) {
            res.status(200).json(resp['rows'][0]);
        } else {
            res.sendStatus(400);
        }
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

module.exports = { 
    register, 
    login, 
    getUser 
};