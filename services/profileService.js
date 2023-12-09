const userRepository = require("../repositories/userRepository");

const setProfilePicture = async (req, res) => {
    try {
        const { image } = req.body;
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
            ? res.status(200).json(resp["rows"][0])
            : res.sendStatus(400);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = {
    getProfile,
    setProfilePicture
};