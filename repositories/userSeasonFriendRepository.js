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
     * Friends dropped from the list are marked declined rather than deleted, so any episodes
     * already synced with them are never touched.
     * @param {number} userSeasonId
     * @param {string[]} friendIds
     * @returns {Promise<string[]>} friend ids that just became newly invited (worth notifying)
     */
    setForUserSeasonId = async (userSeasonId, friendIds) => {
        return db.transaction(async (client) => {
            const current = await client.query(`
                SELECT friend_user_id, status_id FROM users_seasons_friends WHERE users_season_id = $1
            `, [userSeasonId]);
            const currentByFriendId = new Map(current.rows.map((row) => [row["friend_user_id"], row["status_id"]]));
            const newIds = new Set(friendIds);
            const invited = [];

            for (const friendId of currentByFriendId.keys()) {
                if (!newIds.has(friendId) && currentByFriendId.get(friendId) !== "declined") {
                    await client.query(`
                        UPDATE users_seasons_friends SET status_id = 'declined', friend_users_season_id = NULL
                        WHERE users_season_id = $1 AND friend_user_id = $2
                    `, [userSeasonId, friendId]);
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
                        UPDATE users_seasons_friends SET status_id = NULL, friend_users_season_id = NULL
                        WHERE users_season_id = $1 AND friend_user_id = $2
                    `, [userSeasonId, friendId]);
                    invited.push(friendId);
                }
            }
            return invited;
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
     * @param {number} friendUsersSeasonId
     * @returns {Promise<boolean>}
     */
    accept = async (userSeasonId, friendUserId, friendUsersSeasonId) => {
        const res = await db.query(`
            UPDATE users_seasons_friends SET status_id = 'accepted', friend_users_season_id = $3
            WHERE users_season_id = $1 AND friend_user_id = $2
        `, [userSeasonId, friendUserId, friendUsersSeasonId]);
        return res.rowCount === 1;
    }

    /**
     * @param {number} userSeasonId
     * @param {string} friendUserId
     * @returns {Promise<boolean>}
     */
    decline = async (userSeasonId, friendUserId) => {
        const res = await db.query(`
            UPDATE users_seasons_friends SET status_id = 'declined', friend_users_season_id = NULL
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
            SET status_id = 'declined', friend_users_season_id = NULL
            FROM users_seasons us
            WHERE usf.users_season_id = us.id
              AND usf.status_id IS DISTINCT FROM 'declined'
              AND ((us.user_id = $1 AND usf.friend_user_id = $2) OR (us.user_id = $2 AND usf.friend_user_id = $1))
        `, [userIdA, userIdB]);
    }

    /**
     * A viewing must belong to at most one watch-together group: it can't already be someone
     * else's accepted friend-slot, and it can't already be a root with its own accepted friends,
     * before it's linked as a new friend-slot - otherwise the fan-out graph becomes ambiguous.
     * @param {number} viewingId
     * @returns {Promise<boolean>}
     */
    hasConflictingLink = async (viewingId) => {
        const res = await db.query(`
            SELECT EXISTS(
                SELECT 1 FROM users_seasons_friends WHERE friend_users_season_id = $1 AND status_id = 'accepted'
            ) OR EXISTS(
                SELECT 1 FROM users_seasons_friends WHERE users_season_id = $1 AND status_id = 'accepted'
            ) AS conflict
        `, [viewingId]);
        return res.rows[0]["conflict"];
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
     * @returns {Promise<{userSeasonId: number, showId: number, showTitle: string, showPoster: string,
     *   seasonNumber: number, actor: {id: string, username: string, picture: string}}[]>}
     */
    getActiveForUser = async (userId) => {
        const res = await db.query(`
            SELECT us.id AS users_season_id, us.show_id, us.number, s.title, s.poster,
                   owner.id AS owner_id, owner.username AS owner_username, owner.picture AS owner_picture
            FROM users_seasons_friends usf
            JOIN users_seasons us ON us.id = usf.users_season_id
            JOIN shows s ON s.id = us.show_id
            JOIN users owner ON owner.id = us.user_id
            WHERE usf.friend_user_id = $1 AND usf.status_id = 'accepted'
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
     * @param {number} userSeasonId
     * @returns {Promise<{id: number, userId: string}[]>}
     */
    getLinkedViewings = async (userSeasonId) => {
        const res = await db.query(`
            WITH root AS (
                SELECT CASE
                    WHEN EXISTS (SELECT 1 FROM users_seasons_friends WHERE users_season_id = $1)
                        THEN $1
                    ELSE (
                        SELECT users_season_id FROM users_seasons_friends
                        WHERE friend_users_season_id = $1 AND status_id = 'accepted'
                    )
                END AS id
            ),
            members AS (
                SELECT root.id FROM root WHERE root.id IS NOT NULL

                UNION

                SELECT usf.friend_users_season_id AS id
                FROM root
                JOIN users_seasons_friends usf ON usf.users_season_id = root.id
                WHERE usf.status_id = 'accepted' AND usf.friend_users_season_id IS NOT NULL
            )
            SELECT us.id, us.user_id
            FROM members m
            JOIN users_seasons us ON us.id = m.id
            WHERE m.id <> $1
        `, [userSeasonId]);
        return res.rows.map((row) => ({id: row.id, userId: row["user_id"]}));
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
                WHERE us.user_id = $1 AND (usf.status_id IS NULL OR usf.status_id = 'accepted')

                UNION ALL

                SELECT us.user_id AS other_id
                FROM users_seasons_friends usf
                JOIN users_seasons us ON us.id = usf.users_season_id
                WHERE usf.friend_user_id = $1 AND (usf.status_id IS NULL OR usf.status_id = 'accepted')
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
                WHERE us.user_id = $1 AND (usf.status_id IS NULL OR usf.status_id = 'accepted')

                UNION ALL

                SELECT us.user_id AS other_id
                FROM users_seasons_friends usf
                JOIN users_seasons us ON us.id = usf.users_season_id
                WHERE usf.friend_user_id = $1 AND (usf.status_id IS NULL OR usf.status_id = 'accepted')
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
                  AND (usf.status_id IS NULL OR usf.status_id = 'accepted')

                UNION ALL

                SELECT us.user_id AS other_id
                FROM users_seasons_friends usf
                JOIN users_seasons us ON us.id = usf.users_season_id
                WHERE usf.friend_user_id = $1 AND EXTRACT(YEAR FROM us.added_at) = $2
                  AND (usf.status_id IS NULL OR usf.status_id = 'accepted')
            ) pairs
            JOIN users other_user ON other_user.id = pairs.other_id
            GROUP BY other_user.id, other_user.username
            ORDER BY value DESC
            LIMIT 1
        `, [userId, year]);
        return res.rowCount === 1 ? new Stat(res.rows[0]) : null;
    }
}
