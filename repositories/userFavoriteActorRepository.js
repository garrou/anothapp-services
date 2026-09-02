import db from "../config/db.js";
import Actor from "../models/actor.js";

export default class UserFavoriteActorRepository {

    /**
     * @param {string} userId
     * @param {number} actorId
     * @returns {Promise<boolean>}
     */
    create = async (userId, actorId) => {
        const res = await db.query(`
            INSERT INTO users_favorite_actors (user_id, actor_id)
            VALUES ($1, $2)
        `, [userId, actorId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {number} actorId
     * @returns {Promise<boolean>}
     */
    deleteByUserIdActorId = async (userId, actorId) => {
        const res = await db.query(`
            DELETE FROM users_favorite_actors
            WHERE user_id = $1 AND actor_id = $2
        `, [userId, actorId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {number} actorId
     * @returns {Promise<boolean>}
     */
    checkFavoriteExists = async (userId, actorId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM users_favorite_actors
            WHERE user_id = $1 AND actor_id = $2
        `, [userId, actorId]);
        return parseInt(res.rows[0]["total"]) === 1;
    }

    /**
     * @param {string} userId
     * @returns {Promise<Actor[]>}
     */
    getFavoritesByUserId = async (userId) => {
        const res = await db.query(`
            SELECT a.id, a.name, a.picture, a.birthday, a.deathday, a.nationality, a.description
            FROM actors a
            JOIN users_favorite_actors ufa ON ufa.actor_id = a.id
            WHERE ufa.user_id = $1
            ORDER BY ufa.added_at DESC
        `, [userId]);
        return res.rows.map((row) => new Actor(row));
    }
}
