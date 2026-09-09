import db from "../config/db.js";
import Playlist from "../models/playlist.js";
import Show from "../models/show.js";

export default class PlaylistRepository {

    /**
     * @param {string} userId
     * @param {string} name
     * @param {boolean} visible
     * @returns {Promise<Playlist>}
     */
    create = async (userId, name, visible) => {
        const res = await db.query(`
            INSERT INTO playlists (user_id, name, visible)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [userId, name, visible]);
        return new Playlist(res.rows[0]);
    }

    /**
     * @param {number} id
     * @returns {Promise<Playlist|null>}
     */
    getById = async (id) => {
        const res = await db.query(`
            SELECT *
            FROM playlists
            WHERE id = $1
        `, [id]);
        return res.rowCount === 1 ? new Playlist(res.rows[0]) : null;
    }

    /**
     * @param {string} userId
     * @returns {Promise<Playlist[]>}
     */
    getByUserId = async (userId) => {
        const res = await db.query(`
            SELECT p.*, COUNT(ps.show_id) AS shows_count
            FROM playlists p
            LEFT JOIN playlists_shows ps ON ps.playlist_id = p.id
            WHERE p.user_id = $1
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `, [userId]);
        return res.rows.map((row) => new Playlist(row));
    }

    /**
     * @param {string} userId
     * @returns {Promise<Playlist[]>}
     */
    getVisibleByUserId = async (userId) => {
        const res = await db.query(`
            SELECT p.*, COUNT(ps.show_id) AS shows_count
            FROM playlists p
            LEFT JOIN playlists_shows ps ON ps.playlist_id = p.id
            WHERE p.user_id = $1 AND p.visible = TRUE
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `, [userId]);
        return res.rows.map((row) => new Playlist(row));
    }

    /**
     * @param {number} id
     * @param {{name: string?, visible: boolean?}} fields
     * @returns {Promise<boolean>}
     */
    update = async (id, {name, visible}) => {
        const res = await db.query(`
            UPDATE playlists
            SET name = COALESCE($2, name), visible = COALESCE($3, visible)
            WHERE id = $1
        `, [id, name ?? null, visible ?? null]);
        return res.rowCount === 1;
    }

    /**
     * @param {number} id
     * @returns {Promise<boolean>}
     */
    delete = async (id) => {
        const res = await db.query(`
            DELETE FROM playlists WHERE id = $1
        `, [id]);
        return res.rowCount === 1;
    }

    /**
     * @param {number} playlistId
     * @param {number} showId
     * @returns {Promise<void>}
     */
    addShow = async (playlistId, showId) => {
        await db.query(`
            INSERT INTO playlists_shows (playlist_id, show_id)
            VALUES ($1, $2)
            ON CONFLICT (playlist_id, show_id) DO NOTHING
        `, [playlistId, showId]);
    }

    /**
     * @param {number} playlistId
     * @param {number} showId
     * @returns {Promise<boolean>}
     */
    removeShow = async (playlistId, showId) => {
        const res = await db.query(`
            DELETE FROM playlists_shows
            WHERE playlist_id = $1 AND show_id = $2
        `, [playlistId, showId]);
        return res.rowCount === 1;
    }

    /**
     * @param {number} playlistId
     * @returns {Promise<Show[]>}
     */
    getShowsByPlaylistId = async (playlistId) => {
        const res = await db.query(`
            SELECT s.*,
                (SELECT COALESCE(array_agg(k.name ORDER BY k.name), '{}') FROM shows_kinds sk JOIN kinds k ON k.id = sk.kind_id WHERE sk.show_id = s.id) AS kind_names
            FROM shows s
            JOIN playlists_shows ps ON ps.show_id = s.id
            WHERE ps.playlist_id = $1
            ORDER BY ps.added_at DESC
        `, [playlistId]);
        return res.rows.map((row) => new Show(row));
    }
}
