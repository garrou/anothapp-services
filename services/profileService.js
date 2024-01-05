const UserProfile = require("../models/UserProfile");
const userRepository = require("../repositories/userRepository");

const setProfilePicture = async (req, res) => {
    try {
        const { image } = req.body;

        if (!image || typeof str !== "string" || str.trim().length === 0) {
            return res.status(404).json({ "message": "Image invalide" });
        }
        await userRepository.updatePicture(req.user.id, image);
        res.status(200).json({ "message": "Image de profil définie" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getProfile = async (req, res) => {
    try {
        const resp = await userRepository.getUserById(req.user.id);
        return resp.rowCount === 1 
            ? res.status(200).json(new UserProfile(resp["rows"][0]))
            : res.status(400).json({ "message": "Profil introuvable" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = {
    getProfile,
    setProfilePicture
};
