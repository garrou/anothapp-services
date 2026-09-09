import pg from 'pg';

const pool =  new pg.Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    max: 20
});

/**
 * @param {string} query
 * @param {any[]} params
 * @returns {Promise<any>}
 */
const query = async (query, params = []) => {
    return pool.query(query, params);
}

/**
 * @param callback
 * @returns {Promise<any>}
 */
const transaction = async (callback) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const res = await callback(client);
        await client.query("COMMIT");
        return res;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

export default {
    query,
    transaction,
}