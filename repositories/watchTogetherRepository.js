import db from "../config/db.js";

export default class WatchTogetherRepository {

    /**
     * Serializes any accept touching either of these two seasons, whatever their partner
     * season is in each attempt - sorted order avoids deadlocks between two transactions
     * locking the same pair the other way around. Held only for the lifetime of `client`'s
     * transaction (pg_advisory_XACT_lock), released automatically on commit or rollback.
     * @param {import("pg").PoolClient} client
     * @param {number} seasonIdA
     * @param {number} seasonIdB
     * @returns {Promise<void>}
     */
    lockSeasons = async (client, seasonIdA, seasonIdB) => {
        const [first, second] = [seasonIdA, seasonIdB].sort((a, b) => a - b);
        await client.query(`SELECT pg_advisory_xact_lock($1::bigint)`, [first]);
        await client.query(`SELECT pg_advisory_xact_lock($1::bigint)`, [second]);
    }

    /**
     * @param {number} userSeasonId
     * @param {number} friendUsersSeasonId
     * @param {import("pg").PoolClient} client
     * @returns {Promise<boolean>}
     */
    create = async (userSeasonId, friendUsersSeasonId, client = db) => {
        const res = await client.query(`
            INSERT INTO watch_together (users_season_id, friend_users_season_id)
            VALUES ($1, $2)
        `, [userSeasonId, friendUsersSeasonId]);
        return res.rowCount === 1;
    }

    /**
     * Ends the relation, if any, between a viewing and one of its friends. A no-op (not an
     * error) when the pairing was never accepted, e.g. declining a still-pending invite.
     * @param {number} userSeasonId
     * @param {string} friendUserId
     * @param {import("pg").PoolClient} client
     * @returns {Promise<void>}
     */
    remove = async (userSeasonId, friendUserId, client = db) => {
        await client.query(`
            DELETE FROM watch_together
            WHERE users_season_id = $1
              AND friend_users_season_id IN (SELECT id FROM users_seasons WHERE user_id = $2)
        `, [userSeasonId, friendUserId]);
    }

    /**
     * @param {string} userIdA
     * @param {string} userIdB
     * @param {import("pg").PoolClient} client
     * @returns {Promise<void>}
     */
    removeAllBetweenUsers = async (userIdA, userIdB, client = db) => {
        await client.query(`
            DELETE FROM watch_together wt
            USING users_seasons us, users_seasons friend_us
            WHERE wt.users_season_id = us.id AND wt.friend_users_season_id = friend_us.id
              AND ((us.user_id = $1 AND friend_us.user_id = $2) OR (us.user_id = $2 AND friend_us.user_id = $1))
        `, [userIdA, userIdB]);
    }

    /**
     * A viewing must belong to at most one watch-together group: it can't already be someone
     * else's active friend-slot, and it can't already be a root of its own with other accepted
     * friends, before it's linked as a new friend-slot - otherwise the fan-out graph becomes
     * ambiguous. Being a root with OTHER accepted friends is fine and expected (one owner can
     * share with several friends at once), so that case is deliberately not checked here.
     * Call this only after `lockSeasons` has locked both ids in the same transaction, otherwise
     * it's subject to a check-then-act race against a concurrent accept.
     * @param {number} userSeasonId the viewing the invite belongs to (the prospective new root)
     * @param {number} friendUsersSeasonId the friend's own viewing (the prospective new leaf)
     * @param {import("pg").PoolClient} client
     * @returns {Promise<boolean>}
     */
    hasConflictingLink = async (userSeasonId, friendUsersSeasonId, client = db) => {
        const res = await client.query(`
            SELECT EXISTS(
                SELECT 1 FROM watch_together WHERE friend_users_season_id = $1
            ) OR EXISTS(
                SELECT 1 FROM watch_together WHERE users_season_id = $1
            ) OR EXISTS(
                SELECT 1 FROM watch_together WHERE friend_users_season_id = $2
            ) AS conflict
        `, [friendUsersSeasonId, userSeasonId]);
        return res.rows[0]["conflict"];
    }

    /**
     * @param {string} userId
     * @returns {Promise<{userSeasonId: number, showId: number, showTitle: string, showPoster: string,
     *   seasonNumber: number, actor: {id: string, username: string, picture: string}}[]>}
     */
    getActiveForUser = async (userId) => {
        const res = await db.query(`
            SELECT us.id AS users_season_id, us.show_id, us.number, s.title, s.poster,
                   owner.id AS owner_id, owner.username AS owner_username, owner.picture AS owner_picture
            FROM watch_together wt
            JOIN users_seasons us ON us.id = wt.users_season_id
            JOIN users_seasons friend_season ON friend_season.id = wt.friend_users_season_id
            JOIN shows s ON s.id = us.show_id
            JOIN users owner ON owner.id = us.user_id
            WHERE friend_season.user_id = $1
            ORDER BY wt.created_at DESC
        `, [userId]);
        return res.rows.map((row) => ({
            userSeasonId: row["users_season_id"],
            showId: row["show_id"],
            showTitle: row.title,
            showPoster: row.poster,
            seasonNumber: row.number,
            actor: {id: row["owner_id"], username: row["owner_username"], picture: row["owner_picture"]},
        }));
    }

    /**
     * @param {number} userSeasonId
     * @returns {Promise<{id: number, userId: string}[]>}
     */
    getLinkedViewings = async (userSeasonId) => {
        const res = await db.query(`
            WITH root AS (
                SELECT CASE
                    WHEN EXISTS (SELECT 1 FROM watch_together WHERE users_season_id = $1)
                        THEN $1
                    ELSE (
                        SELECT users_season_id FROM watch_together WHERE friend_users_season_id = $1
                    )
                END AS id
            ),
            members AS (
                SELECT root.id FROM root WHERE root.id IS NOT NULL

                UNION

                SELECT wt.friend_users_season_id AS id
                FROM root
                JOIN watch_together wt ON wt.users_season_id = root.id
            )
            SELECT us.id, us.user_id
            FROM members m
            JOIN users_seasons us ON us.id = m.id
            WHERE m.id <> $1
        `, [userSeasonId]);
        return res.rows.map((row) => ({id: row.id, userId: row["user_id"]}));
    }
}
