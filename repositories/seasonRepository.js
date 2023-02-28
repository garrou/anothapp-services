const pool = require('../helpers/db');

/**
 * @param {id} number 
 */
const deleteById = async (id) => {
    try {
        const client = await pool.connect();
        await client.query(`
            DELETE FROM users_seasons
            WHERE id = $1
        `, [id]);
        client.release();
    } catch (err) {
        throw err;
    }
}


const getByShowIdByNumber = async (showId, number) => {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT *
            FROM seasons
            WHERE show_id = $1 AND number = $2
        `, [showId, number]);
        client.release();

        return res;
    } catch (err) {
        console.log(err);
        throw err;
    }
}

const create = async (episode, number, image, showId, epDuration) => {
    try {
        const client = await pool.connect();
        await client.query(`
            INSERT INTO seasons (episode, number, image, show_id, ep_duration)
            VALUES ($1, $2, $3, $4, $5)
        `, [episode, number, image, showId, epDuration]);
        client.release();
    } catch (err) {
        console.log(err)
        throw err;
    }
}

module.exports = {
    create,
    deleteById,
    getByShowIdByNumber
}