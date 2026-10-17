import db from "../config/db.js";
import Actor from "../models/actor.js";

export default class ActorRepository {

    /**
     * @param {number} id
     * @returns {Promise<Actor|null>}
     */
    getActorById = async (id) => {
        const res = await db.query(`
            SELECT id, name, picture, birthday, deathday, nationality, description
            FROM actors
            WHERE id = $1
        `, [id]);
        return res.rowCount === 1 ? new Actor(res.rows[0]) : null;
    }

    /**
     * @param {number} id
     * @param {string} name
     * @param {string?} picture
     * @param {string?} birthday
     * @param {string?} deathday
     * @param {string?} nationality
     * @param {string?} description
     * @returns {Promise<boolean>}
     */
    createActor = async (id, name, picture, birthday, deathday, nationality, description) => {
        const res = await db.query(`
            INSERT INTO actors (id, name, picture, birthday, deathday, nationality, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [id, name, picture, birthday || null, deathday || null, nationality, description]);
        return res.rowCount === 1;
    }

    /**
     * @returns {Promise<Actor[]>}
     */
    getFavoritedActors = async () => {
        const res = await db.query(`
            SELECT DISTINCT a.id, a.name, a.picture, a.birthday, a.deathday, a.nationality, a.description
            FROM actors a
            JOIN users_favorite_actors ufa ON ufa.actor_id = a.id
        `);
        return res.rows.map((row) => new Actor(row));
    }

    /**
     * @param {number} id
     * @param {{name: string, picture: string?, birthday: string?, deathday: string?, nationality: string?, description: string?}} fields
     * @returns {Promise<boolean>}
     */
    updateActor = async (id, {name, picture, birthday, deathday, nationality, description}) => {
        const res = await db.query(`
            UPDATE actors
            SET name = $2, picture = $3, birthday = $4, deathday = $5, nationality = $6, description = $7
            WHERE id = $1
        `, [id, name, picture, birthday || null, deathday || null, nationality, description]);
        return res.rowCount === 1;
    }

    /**
     * @param {number} actorId
     * @param {number[]} showIds
     * @returns {Promise<void>}
     */
    linkShows = async (actorId, showIds) => {
        if (!showIds.length) {
            return;
        }
        await db.query(`
            INSERT INTO shows_actors (show_id, actor_id)
            SELECT s.id, $1 FROM shows s WHERE s.id = ANY($2::int[])
            ON CONFLICT DO NOTHING
        `, [actorId, showIds]);
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns {Promise<{id: number, name: string, picture: string?}[]>}
     */
    getFavoritedActorsByShowId = async (userId, showId) => {
        const res = await db.query(`
            SELECT a.id, a.name, a.picture
            FROM actors a
            JOIN shows_actors sa ON sa.actor_id = a.id
            JOIN users_favorite_actors ufa ON ufa.actor_id = a.id AND ufa.user_id = $1
            WHERE sa.show_id = $2
        `, [userId, showId]);
        return res.rows;
    }
}
