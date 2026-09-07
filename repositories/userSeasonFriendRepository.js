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
            SELECT usf.users_season_id, u.id, u.username, u.picture
            FROM users_seasons_friends usf
            JOIN users u ON u.id = usf.friend_user_id
            WHERE usf.users_season_id = ANY($1::int[])
        `, [userSeasonIds]);

        const map = new Map();
        res.rows.forEach((row) => {
            const list = map.get(row["users_season_id"]) ?? [];
            list.push(new UserProfile(row));
            map.set(row["users_season_id"], list);
        });
        return map;
    }

    /**
     * @param {number} userSeasonId
     * @param {string[]} friendIds
     * @returns {Promise<void>}
     */
    setForUserSeasonId = async (userSeasonId, friendIds) => {
        await db.transaction(async (client) => {
            await client.query(`DELETE FROM users_seasons_friends WHERE users_season_id = $1`, [userSeasonId]);

            if (!friendIds.length) {
                return;
            }
            const values = friendIds.map((_, i) => `($1, $${i + 2})`).join(", ");
            await client.query(
                `INSERT INTO users_seasons_friends (users_season_id, friend_user_id) VALUES ${values}`,
                [userSeasonId, ...friendIds]
            );
        });
    }

    /**
     * @param {string} userId
     * @param {number} limit
     * @returns {Promise<Stat[]>}
     */
    getTopFriendsByUserId = async (userId, limit = 5) => {
        const res = await db.query(`
            SELECT u.id, u.username AS label, COUNT(*) AS value
            FROM users_seasons_friends usf
            JOIN users_seasons us ON us.id = usf.users_season_id
            JOIN users u ON u.id = usf.friend_user_id
            WHERE us.user_id = $1
            GROUP BY u.id, u.username
            ORDER BY value DESC
            LIMIT $2
        `, [userId, limit]);
        return res.rows.map((row) => new Stat(row));
    }
}
