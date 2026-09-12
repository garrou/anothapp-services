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
     * @param {{id: string, name: string}[]} kinds
     * @returns {Promise<void>}
     */
    #syncKinds = async (client, showId, kinds) => {
        await client.query(`DELETE FROM shows_kinds WHERE show_id = $1`, [showId]);

        if (!kinds.length) {
            return;
        }
        // Potential duplicate due to Betaseries
        const names = [...new Set(kinds.map(({name}) => name))];
        const existing = await client.query(`SELECT id, name FROM kinds WHERE name = ANY($1::varchar[])`, [names]);
        const existingIdByName = new Map(existing.rows.map((row) => [row.name, row.id]));

        const resolvedKinds = kinds.map(({id, name}) => ({id: existingIdByName.get(name) ?? id, name}));
        const newKinds = resolvedKinds.filter(({name}) => !existingIdByName.has(name));

        if (newKinds.length) {
            // Sorted by id so concurrent shows introducing the same new kinds always
            // lock those rows in the same order - otherwise two shows whose genres
            // come back in a different order (each show's own object key order, not
            // guaranteed consistent) can deadlock against each other under CONCURRENCY > 1.
            const sortedNewKinds = [...newKinds].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
            const kindValues = sortedNewKinds.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ");
            await client.query(
                `INSERT INTO kinds (id, name) VALUES ${kindValues} ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
                sortedNewKinds.flatMap(({id, name}) => [id, name])
            );
        }

        const resolvedIds = [...new Set(resolvedKinds.map(({id}) => id))];
        const showKindValues = resolvedIds.map((_, i) => `($1, $${i + 2})`).join(", ");
        await client.query(
            `INSERT INTO shows_kinds (show_id, kind_id) VALUES ${showKindValues}`,
            [showId, ...resolvedIds]
        );
    }

    /**
     * @param {number} id
     * @param {string} title
     * @param {string} poster
     * @param {{id: string, name: string}[]} kinds
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
    createShow = async (id, title, poster, kinds, duration, seasons, country, description, creation, network, language, episodes) => {
        return db.transaction(async (client) => {
            const res = await client.query(`
                INSERT INTO shows (id, title, poster, duration, seasons, country, description, creation, network, language, episodes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [id, title, poster, duration, seasons, country, description, creation, network, language, episodes]);

            if (res.rowCount === 1) {
                await this.#syncKinds(client, id, kinds);
            }
            return res.rowCount === 1;
        });
    }

    /**
     * @param {number} showId
     * @param {{id: string, name: string}[]} kinds
     * @returns {Promise<void>}
     */
    setKinds = async (showId, kinds) => {
        return db.transaction((client) => this.#syncKinds(client, showId, kinds));
    }

    /**
     * @param {number} id
     * @returns {Promise<Show|null>}
     */
    getShow = async (id) => {
        const res = await db.query(`
            SELECT id, title, poster, duration, seasons, country, description, creation, network, language, episodes,
                (SELECT COALESCE(array_agg(k.name ORDER BY k.name), '{}') FROM shows_kinds sk JOIN kinds k ON k.id = sk.kind_id WHERE sk.show_id = shows.id) AS kind_names
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
            SELECT id, title, poster, duration, seasons, country, finished, next_episode,
                   description, creation, network, language, episodes
            FROM shows
        `);
        return res.rows;
    }

    /**
     * @param {number} id
     * @param {{poster: string, kinds: {id: string, name: string}[], duration: number, seasons: number, country: string, finished: boolean, nextEpisode: string, description: string?, creation: number?, network: string?, language: string?, episodes: number?}} fields
     * @returns {Promise<boolean>}
     */
    updateShow = async (id, {poster, kinds, duration, seasons, country, finished, nextEpisode, description, creation, network, language, episodes}) => {
        return db.transaction(async (client) => {
            const res = await client.query(`
                UPDATE shows
                SET poster = $2, duration = $3, seasons = $4, country = $5, finished = $6, next_episode = $7,
                    description = $8, creation = $9, network = $10, language = $11, episodes = $12
                WHERE id = $1
            `, [id, poster, duration, seasons, country, finished, nextEpisode, description, creation, network, language, episodes]);

            if (res.rowCount === 1) {
                await this.#syncKinds(client, id, kinds ?? []);
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