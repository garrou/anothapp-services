import db from "../config/db.js";
import Notification from "../models/notification.js";

export default class NotificationRepository {

    /**
     * @param {string} recipientUserId
     * @param {string?} actorUserId
     * @param {string} type
     * @param {number?} showId
     * @param {Object?} metadata
     * @returns {Promise<boolean>}
     */
    create = async (recipientUserId, actorUserId, type, showId, metadata) => {
        const res = await db.query(`
            INSERT INTO notifications (recipient_user_id, actor_user_id, type, show_id, metadata)
            VALUES ($1, $2, $3, $4, $5)
        `, [recipientUserId, actorUserId ?? null, type, showId ?? null, metadata ? JSON.stringify(metadata) : null]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {number} limit
     * @returns {Promise<Notification[]>}
     */
    getByUserId = async (userId, limit = 30) => {
        const res = await db.query(`
            SELECT n.*, u.username AS actor_username, u.picture AS actor_picture,
                   s.title AS show_title, s.poster AS show_poster
            FROM notifications n
            LEFT JOIN users u ON u.id = n.actor_user_id
            LEFT JOIN shows s ON s.id = n.show_id
            WHERE n.recipient_user_id = $1
            ORDER BY n.created_at DESC
            LIMIT $2
        `, [userId, limit]);
        return res.rows.map((row) => new Notification(row));
    }

    /**
     * @param {string} userId
     * @returns {Promise<number>}
     */
    getUnreadCountByUserId = async (userId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total FROM notifications WHERE recipient_user_id = $1 AND read_at IS NULL
        `, [userId]);
        return parseInt(res.rows[0]["total"]);
    }

    /**
     * @param {string} userId
     * @param {number} id
     * @returns {Promise<boolean>}
     */
    markAsRead = async (userId, id) => {
        const res = await db.query(`
            UPDATE notifications SET read_at = NOW()
            WHERE id = $1 AND recipient_user_id = $2 AND read_at IS NULL
        `, [id, userId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @returns {Promise<void>}
     */
    markAllAsRead = async (userId) => {
        await db.query(`
            UPDATE notifications SET read_at = NOW() WHERE recipient_user_id = $1 AND read_at IS NULL
        `, [userId]);
    }

    /**
     * @param {string} date YYYY-MM-DD
     * @returns {Promise<number>}
     */
    createUpcomingEpisodeReminders = async (date) => {
        const res = await db.query(`
            INSERT INTO notifications (recipient_user_id, type, show_id, metadata)
            SELECT us.user_id, 'episode_upcoming', s.id, jsonb_build_object('date', s.next_episode)
            FROM shows s
            JOIN users_shows us ON us.show_id = s.id
            WHERE s.next_episode = $1 AND us.continue = TRUE AND NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.recipient_user_id = us.user_id AND n.show_id = s.id
                AND n.type = 'episode_upcoming' AND n.metadata ->> 'date' = s.next_episode
            )
        `, [date]);
        return res.rowCount;
    }

    /**
     * @param {number} days
     * @returns {Promise<number>}
     */
    deleteOlderThanDays = async (days) => {
        const res = await db.query(`
            DELETE FROM notifications WHERE created_at < NOW() - ($1 * INTERVAL '1 day')
        `, [days]);
        return res.rowCount;
    }
}
