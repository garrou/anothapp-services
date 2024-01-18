const userRepository = require("../repositories/userRepository");
const { comparePassword, createHash, uuid, signJwt } = require("../helpers/security");
const UserProfile = require("../models/UserProfile");

const MIN_PASSWORD = 8;

const checkUser = (_, res) => {
    res.sendStatus(200);
}

const getUser = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ "message": "Email invalide" });
        }
        const rows = await userRepository.getUserByEmail(email.toLowerCase());

        if (rows === 0) {
            return res.status(404).json({ "message": "Aucun résultat" });
        }
        res.status(200).json(rows.map(user => new UserProfile(user)));
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const rows = await userRepository.getUserByEmail(email.toLowerCase());

        if (rows.length === 0) {
            return res.status(400).json({ "message": "Email ou mot de passe incorrect" });
        }
        const same = await comparePassword(password, rows[0]["password"]);

        if (!same) {
            return res.status(400).json({ "message": "Email ou mot de passe incorrect" });
        }
        const token = signJwt(rows[0]["id"], process.env.JWT_SECRET);
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
        if (password.length < MIN_PASSWORD) {
            return res.status(400).json({ "message": `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères` });
        }
        const resp = await userRepository.getUserByEmail(email.toLowerCase());

        if (resp.rowCount > 0) {
            return res.status(409).json({ "message": "Un compte est déjà associé à cet email" });
        }
        const hash = await createHash(password);
        await userRepository.createUser(uuid(), email.toLowerCase(), hash);

        res.status(201).json({ "message": "Compte créé" });
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
        const rows = await userRepository.getUserById(userId);
        return rows.length === 1
            ? res.status(200).json(new UserProfile(rows[0]))
            : res.status(400).json({ "message": "Profil introuvable" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const rows = await userRepository.getUserById(req.user.id);

        if (rows.length === 0) {
            throw new Error();
        }
        const same = await comparePassword(currentPassword, rows[0]["password"]);

        if (!same) {
            return res.status(400).json({ "message": "Mot de passe incorrect" });
        }
        if ((newPassword !== confirmPassword) || (newPassword.length < MIN_PASSWORD)) {
            return res.status(400).json({ "message": `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères` });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({ "message": "Le nouveau mot de passe doit être différent de l'ancien" });
        }
        const hash = await createHash(newPassword);
        await userRepository.updatePassword(req.user.id, hash);
        res.status(200).json({ "message": "Mot de passe modifié" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const changeEmail = async (req, res) => {
    try {
        const { mail, newEmail } = req.body;
        const rows = await userRepository.getUserById(req.user.id);

        if (rows.length === 0) {
            throw new Error();
        }
        if (rows[0]["email"] !== mail) {
            return res.status(400).json({ "message": "Email incorrect" });
        }
        if (mail === newEmail) {
            return res.status(400).json({ "message": "Le nouveau mail doit être différent de l'ancien" });
        }
        await userRepository.updateEmail(req.user.id, newEmail);
        res.status(200).json({ "message": "Mot de passe modifié" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = {
    changeEmail,
    changePassword,
    getUser,
    getProfile,
    setProfilePicture,
    register,
    login,
    checkUser,
};