import db from "../../config/db.js";

/**
 * Wipes every table a test could have written to, cascading from the three "root" tables
 * (nothing referenced by users/shows/actors survives). platforms/notes/kinds are left alone -
 * they're static reference data seeded once by migrations/init.sql, not per-test fixtures.
 * @returns {Promise<void>}
 */
export const resetDb = async () => {
    await db.query(`TRUNCATE TABLE users, shows, actors RESTART IDENTITY CASCADE`);
};
