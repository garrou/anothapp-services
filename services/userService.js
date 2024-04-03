const userRepository = require("../repositories/userRepository");
const { comparePassword, createHash, uuid, signJwt } = require("../helpers/security");
const UserProfile = require("../models/UserProfile");
const { isValidEmail, isValidUsername, isValidPassword, isValidImage, isValidId, isValidChangePassword } = require("../helpers/validator");

const checkUser = (_, res) => {
    res.status(200).json({ "message": "ok" });
}

const getUser = async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) 
            return res.status(400).json({ "message": "Requête invalide" });
        
        const users = (await userRepository.getUserByUsername(username)).reduce((acc, curr) => {
            const user = new UserProfile(curr, true);
            if (user.id !== req.user.id)
                acc.push(user);
            return acc;
        }, []); 
        res.status(200).json(users);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!isValidId(identifier))
            return res.status(400).json({ "message": "Identifiant incorrect" });

        const isEmail = identifier.includes("@");

        const rows = isEmail
            ? await userRepository.getUserByEmail(identifier.toLowerCase())
            : await userRepository.getUserByUsername(identifier);
        
        if (rows.length === 0)
            return res.status(400).json({ "message": `${isEmail ? "Email" : "Username"} ou mot de passe incorrect` });

        const same = await comparePassword(password, rows[0]["password"]);

        if (!same)
            return res.status(400).json({ "message": `${isEmail ? "Email" : "Username"} ou mot de passe incorrect` });
        
        const token = signJwt(rows[0]["id"], process.env.JWT_SECRET);
        res.status(200).json({ "token": token });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const register = async (req, res) => {
    try {
        const { email, username, password, confirm } = req.body;
        const nameValid = isValidUsername(username);

        if (!nameValid.status)
            return res.status(400).json({ "message": nameValid.message });
        
        const emailValid = isValidEmail(email);

        if (!emailValid.status)
            return res.status(400).json({ "message": emailValid.message });
        
        const passValid = isValidPassword(password, confirm);

        if (!passValid.status)
            return res.status(400).json({ "message": passValid.message });
    
        let resp = await userRepository.getUserByEmail(email.toLowerCase());

        if (resp.length > 0)
            return res.status(409).json({ "message": "Un compte est déjà associé à cet email" });

        resp = await userRepository.getUserByUsername(username);

        if (resp.length > 0)
            return res.status(409).json({ "message": "Un compte est déjà associé à ce nom d'utilisateur" });
        
        const hash = await createHash(password);
        await userRepository.createUser(uuid(), email.toLowerCase(), hash, username);
        res.status(201).json({ "message": "Compte créé" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const setProfilePicture = async (req, res) => {
    try {
        const { image } = req.body;

        if (!isValidImage(image))
            return res.status(400).json({ "message": "Image invalide" });

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
        const changeValid = isValidChangePassword(currentPassword, newPassword, confirmPassword);

        if (!changeValid.status)
            return res.status(400).json({ "message": changeValid.message });

        const rows = await userRepository.getUserById(req.user.id);

        if (rows.length === 0)
            throw new Error();
        
        const same = await comparePassword(currentPassword, rows[0]["password"]);

        if (!same)
            return res.status(400).json({ "message": "Mot de passe incorrect" });

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

        if (!mail || !newEmail) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
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
        res.status(200).json({ "message": "Email modifié" });
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