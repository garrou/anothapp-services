import db from "../config/db.js";
import PlaylistCollaborator from "../models/playlistCollaborator.js";
import PlaylistInvitation from "../models/playlistInvitation.js";

export default class PlaylistCollaboratorRepository {

    /**
     * @param {string} playlistId
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    invite = async (playlistId, userId) => {
        const res = await db.query(`
            INSERT INTO playlists_collaborators (playlist_id, user_id)
            VALUES ($1, $2)
        `, [playlistId, userId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} playlistId
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    accept = async (playlistId, userId) => {
        const res = await db.query(`
            UPDATE playlists_collaborators
            SET accepted = TRUE
            WHERE playlist_id = $1 AND user_id = $2
        `, [playlistId, userId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} playlistId
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    remove = async (playlistId, userId) => {
        const res = await db.query(`
            DELETE FROM playlists_collaborators
            WHERE playlist_id = $1 AND user_id = $2
        `, [playlistId, userId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} playlistId
     * @param {string} userId
     * @returns {Promise<boolean>} true if a pending or accepted invite already exists
     */
    checkExists = async (playlistId, userId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM playlists_collaborators
            WHERE playlist_id = $1 AND user_id = $2
        `, [playlistId, userId]);
        return parseInt(res.rows[0]["total"]) === 1;
    }

    /**
     * @param {string} playlistId
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    checkIsAcceptedCollaborator = async (playlistId, userId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM playlists_collaborators
            WHERE playlist_id = $1 AND user_id = $2 AND accepted = TRUE
        `, [playlistId, userId]);
        return parseInt(res.rows[0]["total"]) === 1;
    }

    /**
     * @param {string} playlistId
     * @returns {Promise<PlaylistCollaborator[]>}
     */
    getByPlaylistId = async (playlistId) => {
        const res = await db.query(`
            SELECT u.id, u.username, u.picture, pc.accepted, pc.invited_at
            FROM playlists_collaborators pc
            JOIN users u ON u.id = pc.user_id
            WHERE pc.playlist_id = $1
            ORDER BY pc.invited_at
        `, [playlistId]);
        return res.rows.map((row) => new PlaylistCollaborator(row));
    }

    /**
     * @param {string} userId
     * @returns {Promise<number>} number of playlists this user is an accepted collaborator on
     */
    getCountByUserId = async (userId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM playlists_collaborators
            WHERE user_id = $1 AND accepted = TRUE
        `, [userId]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} playlistId
     * @param {string} userId
     * @returns {Promise<{accepted: boolean}|null>}
     */
    getOne = async (playlistId, userId) => {
        const res = await db.query(`
            SELECT accepted
            FROM playlists_collaborators
            WHERE playlist_id = $1 AND user_id = $2
        `, [playlistId, userId]);
        return res.rowCount === 1 ? {accepted: res.rows[0]["accepted"]} : null;
    }

    /**
     * @param {string} userId1
     * @param {string} userId2
     * @returns {Promise<number>} number of collaborator rows removed
     */
    removeAllBetween = async (userId1, userId2) => {
        const res = await db.query(`
            DELETE FROM playlists_collaborators pc
            USING playlists p
            WHERE pc.playlist_id = p.id
            AND ((p.user_id = $1 AND pc.user_id = $2) OR (p.user_id = $2 AND pc.user_id = $1))
        `, [userId1, userId2]);
        return res.rowCount;
    }

    /**
     * @param {string} userId
     * @returns {Promise<PlaylistInvitation[]>}
     */
    getPendingByUserId = async (userId) => {
        const res = await db.query(`
            SELECT p.id AS playlist_id, p.name AS playlist_name, pc.invited_at,
                   u.id AS owner_id, u.username AS owner_username, u.picture AS owner_picture
            FROM playlists_collaborators pc
            JOIN playlists p ON p.id = pc.playlist_id
            JOIN users u ON u.id = p.user_id
            WHERE pc.user_id = $1 AND pc.accepted = FALSE
            ORDER BY pc.invited_at DESC
        `, [userId]);
        return res.rows.map((row) => new PlaylistInvitation(row));
    }
}
