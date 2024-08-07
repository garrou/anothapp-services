const pool = require('../helpers/db');

/**
 * @returns Promise<any[]>
 */
const getPlatforms = async () => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT id AS pid, name, logo
        FROM platforms
        ORDER BY name
    `);
    client.release();
    return res["rows"];
}

module.exports = {
    getPlatforms
}