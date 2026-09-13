import db from "../config/db.js";
import PlaylistCollaborator from "../models/playlistCollaborator.js";

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
}
