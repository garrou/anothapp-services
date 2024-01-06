const userRepository = require("../repositories/userRepository");
const { comparePassword, createHash, uuid, signJwt } = require("../helpers/security");
const UserProfile = require("../models/UserProfile");

const checkUser = (_, res) => {
    res.sendStatus(200);
}

const getUser = async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) { 
            return res.status(400).json({ "message": "Email invalide" });
        }
        const resp = await userRepository.getUserByEmail(email);

        if (resp.rowCount === 0) {
            return res.status(404).json({ "message": "Aucun résultat" });
        }
        res.status(200).json(resp["rows"].map(user => new UserProfile(user)));
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const resp = await userRepository.getUserByEmail(email.toLowerCase());

        if (resp.rowCount === 0) {
            return res.status(400).json({ "message": "Email ou mot de passe incorrect" });
        }
        const same = await comparePassword(password, resp["rows"][0].password);

        if (!same) {
            return res.status(400).json({ "message": "Email ou mot de passe incorrect" });
        }
        const token = signJwt(resp["rows"][0].id, process.env.JWT_SECRET);
        res.status(200).json({ "token": token });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const register = async (req, res) => {
    try {
        const { email, password, confirm } = req.body;

        if (password != confirm) {
            return res.status(400).json({ "message": "Les mots de passe sont différents" });
        }
        if (password.length < 8) {
            return res.status(400).json({ "message": "Le mot de passe doit faire au moins 8 caractères" });
        }
        const resp = await userRepository.getUserByEmail(email.toLowerCase());

        if (resp.rowCount === 1) {
            return res.status(409).json({ "message": "Un compte est déjà associé à cet email" });
        }
        const hash = await createHash(password);
        await userRepository.createUser(uuid(), email.toLowerCase(), hash);

        res.sendStatus(201);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const setProfilePicture = async (req, res) => {
    try {
        const { image } = req.body;

        if (typeof image !== "string" || image.trim().length === 0) {
            return res.status(400).json({ "message": "Image invalide" });
        }
        await userRepository.updatePicture(req.user.id, image);
        res.status(200).json({ "message": "Image de profil définie" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = id ?? req.user.id;
        const resp = await userRepository.getUserById(userId);
        return resp.rowCount === 1 
            ? res.status(200).json(new UserProfile(resp["rows"][0]))
            : res.status(400).json({ "message": "Profil introuvable" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = { 
    getUser,
    getProfile,
    setProfilePicture,
    register, 
    login, 
    checkUser,
};