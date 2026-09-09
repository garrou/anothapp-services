import db from "../config/db.js";
import Kind from "../models/kind.js";

export default class KindRepository {
    
    /**
     * @returns {Promise<Kind[]>}
     */
    getKinds = async () => {
        const res = await db.query(`
            SELECT id, name
            FROM kinds
            ORDER BY name
        `);
        return res.rows.map((row) => new Kind(row));
    }

    /**
     * @param {string} id
     * @param {string} name
     * @returns {Promise<boolean>}
     */
    upsertKind = async (id, name) => {
        const res = await db.query(`
            INSERT INTO kinds (id, name)
            VALUES ($1, $2)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
        `, [id, name]);
        return res.rowCount === 1;
    }
}
