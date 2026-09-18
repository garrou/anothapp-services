import pg from 'pg';

// By default pg parses DATE columns (OID 1082) into a JS Date set to local-timezone midnight,
// which silently shifts the calendar day when the process runs outside UTC (e.g. birthday
// "1956-03-07" becomes 1956-03-06T23:00:00Z at UTC+1). Every consumer of birthday/deathday
// treats them as opaque "YYYY-MM-DD" strings, so keep the raw string instead of parsing it.
pg.types.setTypeParser(1082, (value) => value);

const pool =  new pg.Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : undefined,
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