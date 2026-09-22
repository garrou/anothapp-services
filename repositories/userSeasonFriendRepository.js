import db from "../config/db.js";
import UserProfile from "../models/userProfile.js";
import Stat from "../models/stat.js";

export default class UserSeasonFriendRepository {

    /**
     * @param {number[]} userSeasonIds
     * @returns {Promise<Map<number, UserProfile[]>>}
     */
    getByUserSeasonIds = async (userSeasonIds) => {
        if (!userSeasonIds.length) {
            return new Map();
        }
        const res = await db.query(`
            SELECT usf.users_season_id, usf.status_id, u.id, u.username, u.picture
            FROM users_seasons_friends usf
            JOIN users u ON u.id = usf.friend_user_id
            WHERE usf.users_season_id = ANY($1::int[])
        `, [userSeasonIds]);

        const map = new Map();
        res.rows.forEach((row) => {
            const list = map.get(row["users_season_id"]) ?? [];
            const profile = new UserProfile(row);
            profile.status = row["status_id"];
            list.push(profile);
            map.set(row["users_season_id"], list);
        });
        return map;
    }

    /**
     * Replaces the tag list for a viewing with `friendIds`, preserving each friend's existing
     * watch-together status instead of resetting everything - only friends genuinely new to the
     * list (or re-added after having declined) start (back) at NULL ("pending"/not yet answered).
     * Friends dropped from the list are marked declined/revoked rather than deleted, so any
     * episodes already synced with them are never touched.
     * @param {number} userSeasonId
     * @param {string[]} friendIds
     * @returns {Promise<{invited: string[], revoked: string[]}>} invited: friend ids newly invited
     *   (worth notifying); revoked: friend ids dropped while their relation was accepted (the
     *   caller must also end their live watch_together relation)
     */
    setForUserSeasonId = async (userSeasonId, friendIds) => {
        return db.transaction(async (client) => {
            const current = await client.query(`
                SELECT friend_user_id, status_id FROM users_seasons_friends WHERE users_season_id = $1
            `, [userSeasonId]);
            const currentByFriendId = new Map(current.rows.map((row) => [row["friend_user_id"], row["status_id"]]));
            const newIds = new Set(friendIds);
            const invited = [];
            const revoked = [];

            for (const friendId of currentByFriendId.keys()) {
                if (!newIds.has(friendId) && currentByFriendId.get(friendId) !== "declined") {
                    const wasAccepted = currentByFriendId.get(friendId) === "accepted";
                    await client.query(`
                        UPDATE users_seasons_friends SET status_id = $3
                        WHERE users_season_id = $1 AND friend_user_id = $2
                    `, [userSeasonId, friendId, wasAccepted ? "revoked" : "declined"]);

                    if (wasAccepted) {
                        revoked.push(friendId);
                    }
                }
            }
            for (const friendId of friendIds) {
                if (!currentByFriendId.has(friendId)) {
                    await client.query(`
                        INSERT INTO users_seasons_friends (users_season_id, friend_user_id) VALUES ($1, $2)
                    `, [userSeasonId, friendId]);
                    invited.push(friendId);
                } else if (currentByFriendId.get(friendId) === "declined") {
                    await client.query(`
                        UPDATE users_seasons_friends SET status_id = NULL
                        WHERE users_season_id = $1 AND friend_user_id = $2
                    `, [userSeasonId, friendId]);
                    invited.push(friendId);
                }
            }
            return {invited, revoked};
        });
    }

    /**
     * @param {number} userSeasonId
     * @param {string} friendUserId
     * @returns {Promise<string|null>} the current status_id ("accepted"/"declined"/null for pending), or undefined if no link exists
     */
    getStatus = async (userSeasonId, friendUserId) => {
        const res = await db.query(`
            SELECT status_id FROM users_seasons_friends WHERE users_season_id = $1 AND friend_user_id = $2
        `, [userSeasonId, friendUserId]);
        return res.rowCount === 1 ? res.rows[0]["status_id"] : undefined;
    }

    /**
     * @param {number} userSeasonId
     * @param {string} friendUserId
     * @returns {Promise<boolean>}
     */
    accept = async (userSeasonId, friendUserId) => {
        const res = await db.query(`
            UPDATE users_seasons_friends SET status_id = 'accepted'
            WHERE users_season_id = $1 AND friend_user_id = $2
        `, [userSeasonId, friendUserId]);
        return res.rowCount === 1;
    }

    /**
     * @param {number} userSeasonId
     * @param {string} friendUserId
     * @returns {Promise<boolean>}
     */
    decline = async (userSeasonId, friendUserId) => {
        // "declined" for an invite that was never accepted, "revoked" for one that was - the
        // latter is still counted as "watched together" in the stats below, the former isn't.
        const res = await db.query(`
            UPDATE users_seasons_friends
            SET status_id = CASE WHEN status_id = 'accepted' THEN 'revoked' ELSE 'declined' END
            WHERE users_season_id = $1 AND friend_user_id = $2
        `, [userSeasonId, friendUserId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userIdA
     * @param {string} userIdB
     * @returns {Promise<void>}
     */
    declineAllBetweenUsers = async (userIdA, userIdB) => {
        await db.query(`
            UPDATE users_seasons_friends usf
            SET status_id = CASE WHEN usf.status_id = 'accepted' THEN 'revoked' ELSE 'declined' END
            FROM users_seasons us
            WHERE usf.users_season_id = us.id
              AND usf.status_id IS DISTINCT FROM 'declined'
              AND ((us.user_id = $1 AND usf.friend_user_id = $2) OR (us.user_id = $2 AND usf.friend_user_id = $1))
        `, [userIdA, userIdB]);
    }

    /**
     * @param {string} userId
     * @returns {Promise<{userSeasonId: number, showId: number, showTitle: string, showPoster: string,
     *   seasonNumber: number, actor: {id: string, username: string, picture: string}}[]>}
     */
    getPendingForUser = async (userId) => {
        const res = await db.query(`
            SELECT us.id AS users_season_id, us.show_id, us.number, s.title, s.poster,
                   owner.id AS owner_id, owner.username AS owner_username, owner.picture AS owner_picture
            FROM users_seasons_friends usf
            JOIN users_seasons us ON us.id = usf.users_season_id
            JOIN shows s ON s.id = us.show_id
            JOIN users owner ON owner.id = us.user_id
            WHERE usf.friend_user_id = $1 AND usf.status_id IS NULL
            ORDER BY us.added_at DESC
        `, [userId]);
        return res.rows.map((row) => ({
            userSeasonId: row["users_season_id"],
            showId: row["show_id"],
            showTitle: row.title,
            showPoster: row.poster,
            seasonNumber: row.number,
            actor: {id: row["owner_id"], username: row["owner_username"], picture: row["owner_picture"]},
        }));
    }

    /**
     * @param {string} userId
     * @param {number} limit
     * @returns {Promise<Stat[]>}
     */
    getTopFriendsByUserId = async (userId, limit = 5) => {
        const res = await db.query(`
            SELECT other_user.id, other_user.username AS label, COUNT(*) AS value
            FROM (
                SELECT usf.friend_user_id AS other_id
                FROM users_seasons_friends usf
                JOIN users_seasons us ON us.id = usf.users_season_id
                WHERE us.user_id = $1 AND (usf.status_id IS NULL OR usf.status_id != 'declined')

                UNION ALL

                SELECT us.user_id AS other_id
                FROM users_seasons_friends usf
                JOIN users_seasons us ON us.id = usf.users_season_id
                WHERE usf.friend_user_id = $1 AND (usf.status_id IS NULL OR usf.status_id != 'declined')
            ) pairs
            JOIN users other_user ON other_user.id = pairs.other_id
            GROUP BY other_user.id, other_user.username
            ORDER BY value DESC
            LIMIT $2
        `, [userId, limit]);
        return res.rows.map((row) => new Stat(row));
    }

    /**
     * @param {string} userId
     * @returns {Promise<number>} distinct friends the user has watched at least one season with
     */
    getDistinctFriendsCountByUserId = async (userId) => {
        const res = await db.query(`
            SELECT COUNT(DISTINCT other_id) AS total
            FROM (
                SELECT usf.friend_user_id AS other_id
                FROM users_seasons_friends usf
                JOIN users_seasons us ON us.id = usf.users_season_id
                WHERE us.user_id = $1 AND (usf.status_id IS NULL OR usf.status_id != 'declined')

                UNION ALL

                SELECT us.user_id AS other_id
                FROM users_seasons_friends usf
                JOIN users_seasons us ON us.id = usf.users_season_id
                WHERE usf.friend_user_id = $1 AND (usf.status_id IS NULL OR usf.status_id != 'declined')
            ) pairs
        `, [userId]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @param {number} year
     * @returns {Promise<Stat|null>}
     */
    getTopFriendByUserIdByYear = async (userId, year) => {
        const res = await db.query(`
            SELECT other_user.id, other_user.username AS label, COUNT(*) AS value
            FROM (
                SELECT usf.friend_user_id AS other_id
                FROM users_seasons_friends usf
                JOIN users_seasons us ON us.id = usf.users_season_id
                WHERE us.user_id = $1 AND EXTRACT(YEAR FROM us.added_at) = $2
                  AND (usf.status_id IS NULL OR usf.status_id != 'declined')

                UNION ALL

                SELECT us.user_id AS other_id
                FROM users_seasons_friends usf
                JOIN users_seasons us ON us.id = usf.users_season_id
                WHERE usf.friend_user_id = $1 AND EXTRACT(YEAR FROM us.added_at) = $2
                  AND (usf.status_id IS NULL OR usf.status_id != 'declined')
            ) pairs
            JOIN users other_user ON other_user.id = pairs.other_id
            GROUP BY other_user.id, other_user.username
            ORDER BY value DESC
            LIMIT 1
        `, [userId, year]);
        return res.rowCount === 1 ? new Stat(res.rows[0]) : null;
    }
}
