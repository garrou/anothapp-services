import db from "../config/db.js";

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
}
