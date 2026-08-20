import db from "../config/db.js";
import {PartialUserEpisode} from "../models/userEpisode.js";

export default class UserEpisodeRepository {

    /**
     * @param {string} userId
     * @param {number} episodeId
     * @param {number} platform
     * @returns {Promise<boolean>}
     */
    create = async (userId, episodeId, platform = 999) => {
        const res = await db.query(`
            INSERT INTO users_episodes (user_id, episode_id, platform_id)
            VALUES ($1, $2, $3)
        `, [userId, episodeId, platform]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {number} episodeId
     * @returns {Promise<PartialUserEpisode[]>}
     */
    getViewingsByUserIdByEpisodeId = async (userId, episodeId) => {
        const res = await db.query(`
            SELECT ue.id, ue.added_at, p.id AS pid, p.name, p.logo
            FROM users_episodes ue
            LEFT JOIN platforms p ON p.id = ue.platform_id
            WHERE user_id = $1 AND episode_id = $2
            ORDER BY added_at
        `, [userId, episodeId]);
        return res.rows.map((row) => new PartialUserEpisode(row));
    }
}
