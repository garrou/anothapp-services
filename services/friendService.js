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
    } catch (e) {
        res.status(500).json({ "message": e.message });
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
            return res.status(409).json({ "message": "Vous êtes déjà en relation avec cet utilisateur" });
        }
        await friendRepository.sendFriendRequest(req.user.id, userId);
        res.status(201).json({ "message": "ok" });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const deleteFriend = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        await friendRepository.deleteFriend(req.user.id, userId);
        res.status(200).json({ "message": "ok" });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getFriends = async (req, res) => {
    try {
        const { status, serieId } = req.query;
        const users = await getFriendsByUserIdByStatus(req.user.id, status, serieId);
        res.status(200).json(status ? { [status]: users } : users);
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

/**
 * @param {string} userId 
 * @param {string} status
 * @param {number?} showId
 * @returns {Friend[] | map<string, Friend[]>}
 */
const getFriendsByUserIdByStatus = async (userId, status, showId) => {
    let rows = null;
    const mapToUser = (arr) => arr.map(user => new UserProfile(user));

    switch (status) {
        case "send":
            rows = (await friendRepository.getFriendsRequestsSend(userId));
            break;
        case "receive":
            rows = (await friendRepository.getFriendsRequestsReceive(userId));
            break;
        case "friend":
            rows = (await friendRepository.getFriends(userId));
            break;
        case "viewed":
            if (!showId) throw new Error("Requête invalide");
            rows = await friendRepository.getFriendsWhoWatchSerie(userId, showId)
            break;
        default:
            return {
                "send": mapToUser(await friendRepository.getFriendsRequestsSend(userId)),
                "receive": mapToUser(await friendRepository.getFriendsRequestsReceive(userId)),
                "friend": mapToUser(await friendRepository.getFriends(userId))
            }
    }
    return rows ? mapToUser(rows) : [];
}

module.exports = {
    deleteFriend,
    getFriends,
    acceptFriend,
    sendFriendRequest
}
