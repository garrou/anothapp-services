import db from "../config/db.js";
import Episode from "../models/episode.js";

export default class EpisodeRepository {

    /**
     * @param {number} showId
     * @param {number} seasonNumber
     * @returns {Promise<Episode[]>}
     */
    getEpisodesByShowIdBySeason = async (showId, seasonNumber) => {
        const res = await db.query(`
            SELECT *
            FROM episodes
            WHERE show_id = $1 AND season_number = $2
            ORDER BY number
        `, [showId, seasonNumber]);
        return res.rows.map((row) => new Episode(row));
    }

    /**
     * @param {number} id
     * @returns {Promise<Episode|null>}
     */
    getEpisodeById = async (id) => {
        const res = await db.query(`
            SELECT * FROM episodes WHERE id = $1
        `, [id]);
        return res.rowCount === 1 ? new Episode(res.rows[0]) : null;
    }

    /**
     * @param {number} id
     * @param {number} showId
     * @param {number} seasonNumber
     * @param {number} number
     * @param {string} title
     * @param {string} code
     * @param {number} global
     * @param {number} length
     * @param {string?} date
     * @param {string?} description
     * @returns {Promise<boolean>}
     */
    upsertEpisode = async (id, showId, seasonNumber, number, title, code, global, length, date, description) => {
        const res = await db.query(`
            INSERT INTO episodes (id, show_id, season_number, number, title, code, global, length, date, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE
            SET title = EXCLUDED.title, code = EXCLUDED.code, global = EXCLUDED.global,
                length = EXCLUDED.length, date = EXCLUDED.date, description = EXCLUDED.description
        `, [id, showId, seasonNumber, number, title, code, global, length, date ?? null, description ?? null]);
        return res.rowCount === 1;
    }

    /**
     * @returns {Promise<{show_id: number, season_number: number}[]>} every distinct show/season pair currently synced
     */
    getAllEpisodeSeasons = async () => {
        const res = await db.query(`
            SELECT DISTINCT e.show_id, e.season_number
            FROM episodes e
            JOIN shows s ON s.id = e.show_id
            WHERE s.finished = FALSE
            ORDER BY e.show_id, e.season_number
        `);
        return res.rows;
    }

    /**
     * @param {number} showId
     * @param {number} seasonNumber
     * @param {number[]} ids ids that must be kept
     * @returns {Promise<number>} number of rows deleted
     */
    deleteEpisodesNotIn = async (showId, seasonNumber, ids) => {
        const res = await db.query(`
            DELETE FROM episodes
            WHERE show_id = $1 AND season_number = $2 AND NOT (id = ANY($3::int[]))
        `, [showId, seasonNumber, ids]);
        return res.rowCount;
    }
}
