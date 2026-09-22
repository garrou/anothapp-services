import db from "../config/db.js";

export default class CatalogRepository {

    /**
     * @returns {Promise<{shows: number, seasons: number, episodes: number}>}
     */
    getCounts = async () => {
        const [showsRes, seasonsRes, episodesRes] = await Promise.all([
            db.query(`SELECT COUNT(*) AS total FROM shows`),
            db.query(`SELECT COUNT(*) AS total FROM seasons`),
            db.query(`SELECT COUNT(*) AS total FROM episodes`),
        ]);
        return {
            shows: parseInt(showsRes.rows[0]["total"]),
            seasons: parseInt(seasonsRes.rows[0]["total"]),
            episodes: parseInt(episodesRes.rows[0]["total"]),
        };
    }

    /**
     * @param {{shows: number, seasons: number, episodes: number}} counts
     * @returns {Promise<void>}
     */
    recordSizeSnapshot = async (counts) => {
        await db.query(`
            INSERT INTO catalog_size_history (shows_count, seasons_count, episodes_count)
            VALUES ($1, $2, $3)
        `, [counts.shows, counts.seasons, counts.episodes]);
    }

    /**
     * @param {number} limit
     * @returns {Promise<{recordedAt: string, shows: number, seasons: number, episodes: number}[]>} oldest first
     */
    getSizeHistory = async (limit = 52) => {
        const res = await db.query(`
            SELECT recorded_at, shows_count, seasons_count, episodes_count
            FROM catalog_size_history
            ORDER BY recorded_at DESC
            LIMIT $1
        `, [limit]);
        return res.rows.reverse().map((row) => ({
            recordedAt: row["recorded_at"],
            shows: parseInt(row["shows_count"]),
            seasons: parseInt(row["seasons_count"]),
            episodes: parseInt(row["episodes_count"]),
        }));
    }
}
