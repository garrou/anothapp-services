import db from "../config/db.js";

export default class ShowRepository {

    /**
     * @param {number} id
     * @returns {Promise<boolean>}
     */
    isNewShow = async (id) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM shows
            WHERE id = $1
        `, [id]);
        return parseInt(res.rows[0]["total"]) === 0;
    }

    /**
     * @param {number} id
     * @param {string} title
     * @param {string} poster
     * @param {string} kinds
     * @param {number} duration
     * @param {number} seasons
     * @param {string} country
     * @returns {Promise<boolean>}
     */
    createShow = async (id, title, poster, kinds, duration, seasons, country) => {
        const res = await db.query(`
            INSERT INTO shows (id, title, poster, kinds, duration, seasons, country)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [id, title, poster, kinds, duration, seasons, country]);
        return res.rowCount === 1;
    }
}