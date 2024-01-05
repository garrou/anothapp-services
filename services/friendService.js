const UserProfile = require("../models/UserProfile");
const friendRepository = require("../repositories/friendRepository");

const updateFriendRequest = async (req, res) => {
    try {
        const { userId } = req.body;
        await friendRepository.updateFriendRequest(userId, req.user.id);
        res.sendStatus(200);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const sendFriendRequest = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(404).json({ "message": "Requête invalide" });
        }
        const occurence = await friendRepository.checkIfRelationExists(req.user.id, userId);

        if (occurence === 1) { 
            return res.status(409).json({ "message": "Vous êtes déjà amis avec cet utilisateur" });
        }
        await friendRepository.sendFriendRequest(req.user.id, userId);
        res.sendStatus(201);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getFriend = (req, res) => {
    try {

    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getFriends = async (req, res) => {
    try {
        const { status } = req.query;
        let response = null;

        switch (status) {
            case "send":
                response = (await friendRepository.getFriendsRequestsSend(req.user.id))["rows"]
                    .map(user => new UserProfile(user));
                break;
            case "receive":
                response = (await friendRepository.getFriendsRequestsReceive(req.user.id))["rows"]
                    .map(user => new UserProfile(user));
                break;
            case "friend":
                response = (await friendRepository.getFriends(req.user.id))["rows"]
                    .map(user => new UserProfile(user))
                    .filter(user => user.id !== req.user.id);
                break;
            default:
                throw new Error("Invalid type");
        }
        res.status(200).json(response);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = {
    getFriend,
    getFriends,
    updateFriendRequest,
    sendFriendRequest
}