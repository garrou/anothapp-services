import db from "../config/db.js";

export default class WatchTogetherRepository {

    /**
     * @param {number} userSeasonId
     * @param {number} friendUsersSeasonId
     * @param {string} friendUserId
     * @returns {Promise<boolean>}
     */
    create = async (userSeasonId, friendUsersSeasonId, friendUserId) => {
        const res = await db.query(`
            INSERT INTO watch_together (users_season_id, friend_users_season_id, friend_user_id)
            VALUES ($1, $2, $3)
        `, [userSeasonId, friendUsersSeasonId, friendUserId]);
        return res.rowCount === 1;
    }

    /**
     * Ends the relation, if any, between a viewing and one of its friends. A no-op (not an
     * error) when the pairing was never accepted, e.g. declining a still-pending invite.
     * @param {number} userSeasonId
     * @param {string} friendUserId
     * @returns {Promise<void>}
     */
    remove = async (userSeasonId, friendUserId) => {
        await db.query(`
            DELETE FROM watch_together WHERE users_season_id = $1 AND friend_user_id = $2
        `, [userSeasonId, friendUserId]);
    }

    /**
     * @param {string} userIdA
     * @param {string} userIdB
     * @returns {Promise<void>}
     */
    removeAllBetweenUsers = async (userIdA, userIdB) => {
        await db.query(`
            DELETE FROM watch_together wt
            USING users_seasons us
            WHERE wt.users_season_id = us.id
              AND ((us.user_id = $1 AND wt.friend_user_id = $2) OR (us.user_id = $2 AND wt.friend_user_id = $1))
        `, [userIdA, userIdB]);
    }

    /**
     * A viewing must belong to at most one watch-together group: it can't already be someone
     * else's active friend-slot, and it can't already be a root of its own with other accepted
     * friends, before it's linked as a new friend-slot - otherwise the fan-out graph becomes
     * ambiguous. Being a root with OTHER accepted friends is fine and expected (one owner can
     * share with several friends at once), so that case is deliberately not checked here.
     * @param {number} userSeasonId the viewing the invite belongs to (the prospective new root)
     * @param {number} friendUsersSeasonId the friend's own viewing (the prospective new leaf)
     * @returns {Promise<boolean>}
     */
    hasConflictingLink = async (userSeasonId, friendUsersSeasonId) => {
        const res = await db.query(`
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
            JOIN shows s ON s.id = us.show_id
            JOIN users owner ON owner.id = us.user_id
            WHERE wt.friend_user_id = $1
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
