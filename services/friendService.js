const UserProfile = require("../models/UserProfile");
const friendRepository = require("../repositories/friendRepository");

const acceptFriend = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        await friendRepository.acceptFriend(userId, req.user.id);
        res.status(200).json({ "message": "ok" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const sendFriendRequest = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const exists = await friendRepository.checkIfRelationExists(req.user.id, userId);

        if (exists) {
            return res.status(409).json({ "message": "Vous êtes déjà amis avec cet utilisateur" });
        }
        await friendRepository.sendFriendRequest(req.user.id, userId);
        res.status(201).json({ "message": "ok" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const deleteFriend = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        await friendRepository.deleteFriend(req.user.id, userId);
        res.status(204).json({ "message": "ok" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getFriends = async (req, res) => {
    try {
        const { status } = req.query;
        let rows = [];

        switch (status) {
            case "send":
                rows = (await friendRepository.getFriendsRequestsSend(req.user.id))
                    .map(user => new UserProfile(user));
                break;
            case "receive":
                rows = (await friendRepository.getFriendsRequestsReceive(req.user.id))
                    .map(user => new UserProfile(user));
                break;
            case "friend":
                rows = (await friendRepository.getFriends(req.user.id))
                    .map(user => new UserProfile(user))
                    .filter(user => user.id !== req.user.id);
                break;
            default:
                throw new Error("Invalid type");
        }
        res.status(200).json(rows);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = {
    deleteFriend,
    getFriends,
    acceptFriend,
    sendFriendRequest
}
