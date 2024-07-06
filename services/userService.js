const userRepository = require("../repositories/userRepository");
const { comparePassword, createHash, uuid, signJwt } = require("../helpers/security");
const UserProfile = require("../models/UserProfile");
const { isValidEmail, isValidUsername, isValidPassword, isValidImage, isValidId, isValidChangePassword, isValidChangeEmail } = require("../helpers/validator");

const checkUser = (_, res) => {
    res.status(200).json({ "message": "ok" });
}

const getUser = async (req, res) => {
    try {
        const { username } = req.body;

        if (!username)
            return res.status(400).json({ "message": "Requête invalide" });

        const users = (await userRepository.getUserByUsername(username)).reduce((acc, curr) => {
            const user = new UserProfile(curr);
            if (user.id !== req.user.id)
                acc.push(user);
            return acc;
        }, []);
        res.status(200).json(users);
    } catch (e) {
        res.status(500).json({ "message": e.message });
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
            : await userRepository.getUserByUsername(identifier, true);

        if (rows.length === 0)
            return res.status(400).json({ "message": `${isEmail ? "Email" : "Username"} ou mot de passe incorrect` });

        const same = await comparePassword(password, rows[0]["password"]);

        if (!same)
            return res.status(400).json({ "message": `${isEmail ? "Email" : "Username"} ou mot de passe incorrect` });

        const token = signJwt(rows[0]["id"], process.env.JWT_SECRET);
        const user = new UserProfile(rows[0], true);
        res.status(200).json({ "token": token, ...user });
    } catch (e) {
        res.status(500).json({ "message": e.message });
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

        resp = await userRepository.getUserByUsername(username, true);

        if (resp.length > 0)
            return res.status(409).json({ "message": "Un compte est déjà associé à ce nom d'utilisateur" });

        const hash = await createHash(password);
        await userRepository.createUser(uuid(), email.toLowerCase(), hash, username);
        res.status(201).json({ "message": "Compte créé" });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const setProfilePicture = async (req, res) => {
    try {
        const { image } = req.body;

        if (!isValidImage(image))
            return res.status(400).json({ "message": "Image invalide" });

        await userRepository.updatePicture(req.user.id, image);
        res.status(200).json({ "message": "Image de profil définie" });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = id ?? req.user.id;
        const rows = await userRepository.getUserById(userId);
        return rows.length === 1
            ? res.status(200).json(new UserProfile(rows[0], !id))
            : res.status(400).json({ "message": "Profil introuvable" });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const changeProfile = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword, email, newEmail, image } = req.body;

        if (currentPassword && newPassword && confirmPassword) {
            await changePassword(req.user.id, currentPassword, newPassword, confirmPassword);
            return res.status(200).json({ "message": "Mot de passe modifié" });
        } else if (email && newEmail) {
            await changeEmail(req.user.id, email, newEmail);
            return res.status(200).json({ "message": "Email modifié" });
        } else if (image) {
            await changeImage(req.user.id, image);
            return res.status(200).json({ "message": "Image de profil définie" });
        }
        res.status(400).json({ "message": "Requête invalide" });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

/**
 * @param {string} userId 
 * @param {string} image 
 */
const changeImage = async (userId, image) => {
    if (!isValidImage(image))
       throw new Error("Image invalide");

    await userRepository.updatePicture(userId, image);
}

/**
 * @param {string} userId
 * @param {string} currentPass 
 * @param {string} newPass 
 * @param {string} confirmPass 
 */
const changePassword = async (userId, currentPass, newPass, confirmPass) => {
    const changeValid = isValidChangePassword(currentPass, newPass, confirmPass);

    if (!changeValid.status)
        throw new Error(changeValid.message);

    const rows = await userRepository.getUserById(userId);

    if (rows.length === 0)
        throw new Error("Utilisateur inconnu");

    const same = await comparePassword(currentPass, rows[0]["password"]);

    if (!same)
        throw new Error("Mot de passe incorrect");

    const hash = await createHash(newPass);
    await userRepository.updatePassword(userId, hash);
}

/**
 * @param {string} userId 
 * @param {string} email 
 * @param {string} newEmail 
 */
const changeEmail = async (userId, email, newEmail) => {
    const changeValid = isValidChangeEmail(email, newEmail);

    if (!changeValid.status)
        throw new Error(changeValid.message);

    let rows = await userRepository.getUserById(userId);

    if (rows.length === 0)
        throw new Error("Utilisateur inconnu");

    if (rows[0]["email"] !== email)
        throw new Error("Email incorrect");

    if (email === newEmail)
        throw new Error("Le nouveau mail doit être différent de l'ancien");
    
    rows = await userRepository.getUserByEmail(newEmail);

    if (rows.length > 0)
        throw new Error("Cet email est déjà associé à un compte");

    await userRepository.updateEmail(userId, newEmail);
}

module.exports = {
    changeProfile,
    getUser,
    getProfile,
    setProfilePicture,
    register,
    login,
    checkUser,
};