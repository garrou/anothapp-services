import db from "../config/db.js";
import Show from "../models/show.js";

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
     * @param {string} client
     * @param {number} showId
     * @param {string[]} kindIds
     * @returns {Promise<void>}
     */
    #syncKinds = async (client, showId, kindIds) => {
        await client.query(`DELETE FROM shows_kinds WHERE show_id = $1`, [showId]);

        if (!kindIds.length) {
            return;
        }
        const values = kindIds.map((_, i) => `($1, $${i + 2})`).join(", ");
        await client.query(
            `INSERT INTO shows_kinds (show_id, kind_id) VALUES ${values}`,
            [showId, ...kindIds]
        );
    }

    /**
     * @param {number} id
     * @param {string} title
     * @param {string} poster
     * @param {string} kinds
     * @param {string[]} kindIds
     * @param {number} duration
     * @param {number} seasons
     * @param {string} country
     * @param {string?} description
     * @param {number?} creation
     * @param {string?} network
     * @param {string?} language
     * @param {number?} episodes
     * @returns {Promise<boolean>}
     */
    createShow = async (id, title, poster, kinds, kindIds, duration, seasons, country, description, creation, network, language, episodes) => {
        return db.transaction(async (client) => {
            const res = await client.query(`
                INSERT INTO shows (id, title, poster, kinds, duration, seasons, country, description, creation, network, language, episodes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [id, title, poster, kinds, duration, seasons, country, description, creation, network, language, episodes]);

            if (res.rowCount === 1) {
                await this.#syncKinds(client, id, kindIds);
            }
            return res.rowCount === 1;
        });
    }

    /**
     * @param {number} id
     * @returns {Promise<Show|null>}
     */
    getShow = async (id) => {
        const res = await db.query(`
            SELECT id, title, poster, kinds, duration, seasons, country, description, creation, network, language, episodes
            FROM shows
            WHERE id = $1
        `, [id])
        return res.rowCount === 1 ? new Show(res.rows[0]) : null;
    }

    /**
     * @returns {Promise<any[]>}
     */
    getAllShows = async () => {
        const res = await db.query(`
            SELECT id, title, poster, kinds, duration, seasons, country, finished, next_episode,
                   description, creation, network, language, episodes
            FROM shows
        `);
        return res.rows;
    }

    /**
     * @param {number} id
     * @param {{poster: string, kinds: string, kindIds: string[], duration: number, seasons: number, country: string, finished: boolean, nextEpisode: string, description: string?, creation: number?, network: string?, language: string?, episodes: number?}} fields
     * @returns {Promise<boolean>}
     */
    updateShow = async (id, {poster, kinds, kindIds, duration, seasons, country, finished, nextEpisode, description, creation, network, language, episodes}) => {
        return db.transaction(async (client) => {
            const res = await client.query(`
                UPDATE shows
                SET poster = $2, kinds = $3, duration = $4, seasons = $5, country = $6, finished = $7, next_episode = $8,
                    description = $9, creation = $10, network = $11, language = $12, episodes = $13
                WHERE id = $1
            `, [id, poster, kinds, duration, seasons, country, finished, nextEpisode, description, creation, network, language, episodes]);

            if (res.rowCount === 1) {
                await this.#syncKinds(client, id, kindIds ?? []);
            }
            return res.rowCount === 1;
        });
    }

    /**
     * @param {number} id
     * @returns {Promise<boolean>}
     */
    deleteShow = async (id) => {
        const res = await db.query(`
            DELETE FROM shows WHERE id = $1
        `, [id]);
        return res.rowCount === 1;
    }
}