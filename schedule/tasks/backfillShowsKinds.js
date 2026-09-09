import db from "../../config/db.js";

/**
 * @returns {Promise<{updated: number, total: number, orphanNames: string[], failed: any[]}>}
 */
const backfillShowsKinds = async () => {
    const kindsRes = await db.query(`SELECT id, name FROM kinds`);
    const idByName = new Map(kindsRes.rows.map((row) => [row.name, row.id]));

    const showsRes = await db.query(`SELECT id, title, kinds FROM shows`);
    const shows = showsRes.rows;
    const orphanNames = new Set();
    const failed = [];
    let updated = 0;

    for (const show of shows) {
        const names = (show.kinds ?? "").split(";").filter(Boolean);
        const kindIds = [];

        for (const name of names) {
            const id = idByName.get(name);

            if (id) {
                kindIds.push(id);
            } else {
                orphanNames.add(name);
            }
        }
        if (!kindIds.length) {
            continue;
        }

        try {
            await db.transaction(async (client) => {
                await client.query(`DELETE FROM shows_kinds WHERE show_id = $1`, [show.id]);

                const values = kindIds.map((_, i) => `($1, $${i + 2})`).join(", ");
                await client.query(
                    `INSERT INTO shows_kinds (show_id, kind_id) VALUES ${values}`,
                    [show.id, ...kindIds]
                );
            });
            updated += 1;
        } catch (error) {
            failed.push({id: show.id, title: show.title, error: error.message});
        }
    }
    return {updated, total: shows.length, orphanNames: [...orphanNames].sort(), failed};
};

export default backfillShowsKinds;
