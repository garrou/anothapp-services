import db from "../config/db.js";
import {cumulate, frenchMonth} from "../helpers/utils.js";
import Season from "../models/season.js";
import {PartialUserSeason, UserSeason} from "../models/userSeason.js";
import Stat from "../models/stat.js";
import UserSeasonFriendRepository from "./userSeasonFriendRepository.js";

export default class UserSeasonRepository {

    constructor() {
        this._userSeasonFriendRepository = new UserSeasonFriendRepository();
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @param {number} number
     * @param {number} platform
     * @param {string?} addedAt used on import, to restore the exported viewing date instead of NOW()
     * @returns {Promise<number|null>} the created row's id, or null on failure
     */
    create = async (userId, showId, number, platform = 999, addedAt = null) => {
        const res = await db.query(`
            INSERT INTO users_seasons (user_id, show_id, number, platform_id, added_at)
            VALUES ($1, $2, $3, $4, COALESCE($5, NOW()))
            RETURNING id
        `, [userId, showId, number, platform, addedAt]);
        return res.rowCount === 1 ? res.rows[0]["id"] : null;
    }

    /**
     * Guards import re-runs against duplicating the same viewing (e.g. a rewatch) twice.
     * added_at is compared truncated to milliseconds, since it round-trips through a JS Date
     * during export (millisecond precision only) while Postgres itself stores microseconds -
     * an exact match would miss a viewing whose original added_at wasn't itself millisecond-aligned
     * (e.g. one set by NOW()). IS NOT DISTINCT FROM also lets a NULL addedAt match a NULL column.
     * @param {string} userId
     * @param {number} showId
     * @param {number} number
     * @param {string?} addedAt
     * @returns {Promise<number|null>} the id of the already-imported viewing, if any
     */
    findImportedViewing = async (userId, showId, number, addedAt) => {
        const res = await db.query(`
            SELECT id FROM users_seasons
            WHERE user_id = $1 AND show_id = $2 AND number = $3
              AND date_trunc('milliseconds', added_at) IS NOT DISTINCT FROM date_trunc('milliseconds', $4::timestamptz)
        `, [userId, showId, number, addedAt]);
        return res.rowCount === 1 ? res.rows[0]["id"] : null;
    }

    /**
     * @param {string} userId
     * @param {number} id
     * @returns {Promise<{showId: number, number: number, platformId: number}|null>} the show/number/platform of that viewing if owned by userId
     */
    getOwnedSeasonViewing = async (userId, id) => {
        const res = await db.query(`
            SELECT show_id, number, platform_id FROM users_seasons WHERE id = $1 AND user_id = $2
        `, [id, userId]);
        return res.rowCount === 1
            ? {showId: res.rows[0]["show_id"], number: res.rows[0]["number"], platformId: res.rows[0]["platform_id"]}
            : null;
    }

    /**
     * @param {number} id
     * @returns {Promise<{userId: string, showId: number, number: number, platformId: number}|null>}
     */
    getSeasonViewingById = async (id) => {
        const res = await db.query(`
            SELECT user_id, show_id, number, platform_id FROM users_seasons WHERE id = $1
        `, [id]);
        return res.rowCount === 1 ? {
            userId: res.rows[0]["user_id"],
            showId: res.rows[0]["show_id"],
            number: res.rows[0].number,
            platformId: res.rows[0]["platform_id"],
        } : null;
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @param {number} number
     * @returns {Promise<number|null>} the id of any existing viewing of that season by userId
     */
    findAnyByUserIdShowIdNumber = async (userId, showId, number) => {
        const res = await db.query(`
            SELECT id FROM users_seasons WHERE user_id = $1 AND show_id = $2 AND number = $3 LIMIT 1
        `, [userId, showId, number]);
        return res.rowCount === 1 ? res.rows[0]["id"] : null;
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns {Promise<Season[]>}
     */
    getDistinctByUserIdByShowId = async (userId, showId) => {
        const res = await db.query(`
            SELECT DISTINCT
            ON (users_seasons.number) users_seasons.number, seasons.image, users_seasons.number, seasons.episodes
            FROM users_seasons
            JOIN seasons
            ON seasons.show_id = users_seasons.show_id AND seasons.number = users_seasons.number
            WHERE users_seasons.user_id = $1 AND users_seasons.show_id = $2
            ORDER BY users_seasons.number
        `, [userId, showId]);
        const episodes = cumulate(res.rows, "episodes");
        return res.rows.map((row, i) => new Season(row, `${episodes[i] + 1} - ${episodes[i + 1]}`));
    }

    /**
     * @param {string} userId
     * @returns {Promise<UserSeason[]>}
     */
    getUserSeasonsByUserId = async (userId) => {
        const res = await db.query(`
            SELECT us.id, us.added_at, us.show_id, us.number, us.platform_id, p.name as platform,
                   s.image, s.episodes
            FROM users_seasons us
            JOIN platforms p on us.platform_id = p.id
            JOIN seasons s ON s.show_id = us.show_id AND s.number = us.number
            WHERE us.user_id = $1
            ORDER BY us.show_id, us.number, us.added_at
        `, [userId]);
        return res.rows.map((row) => new UserSeason(row));
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @param {number} number
     * @returns {Promise<PartialUserSeason[]>}
     */
    getInfosByUserIdByShowId = async (userId, showId, number) => {
        const res = await db.query(`
            SELECT us.id, us.added_at, p.id AS pid, p.name, p.logo
            FROM users_seasons us
            LEFT JOIN platforms p ON p.id = us.platform_id
            WHERE user_id = $1 AND show_id = $2 AND number = $3
            ORDER BY added_at
        `, [userId, showId, number]);
        const watchedWithByUserSeasonId = await this._userSeasonFriendRepository.getByUserSeasonIds(
            res.rows.map((row) => row.id)
        );
        return res.rows.map((row) => new PartialUserSeason(row, watchedWithByUserSeasonId.get(row.id) ?? []));
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @param {number} number
     * @returns {Promise<number>}
     */
    getViewingTimeByUserIdByShowIdByNumber = async (userId, showId, number) => {
        const res = await db.query(`
            SELECT SUM(seasons.episodes * shows.duration) AS time
            FROM users_seasons
            JOIN seasons
            ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
            JOIN shows ON seasons.show_id = shows.id
            WHERE users_seasons.user_id = $1 AND users_seasons.show_id = $2 AND users_seasons.number = $3
        `, [userId, showId, number]);
        return parseInt(res.rows[0]["time"]);
    }

    /**
     * @param {string} userId
     * @returns {Promise<Stat[]>}
     */
    getNbSeasonsByUserIdGroupByYear = async (userId) => {
        const res = await db.query(`
            SELECT EXTRACT(YEAR FROM added_at) AS label, COUNT(*) AS value
            FROM users_seasons
            JOIN seasons
            ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number AND DATE_PART('year', NOW()) - EXTRACT (YEAR FROM added_at) <= 10
            WHERE users_seasons.user_id = $1
            GROUP BY label
            ORDER BY label
        `, [userId]);
        return res.rows.map((row) => new Stat(row));
    }

    /**
     * @param {string} userId
     * @returns {Promise<Stat[]>}
     */
    getNbSeasonsByUserIdGroupByMonth = async (userId) => {
        const res = await db.query(`
            SELECT EXTRACT(MONTH FROM added_at) AS num, COUNT(*) AS value
            FROM users_seasons
            WHERE users_seasons.user_id = $1
            GROUP BY num
            ORDER BY num
        `, [userId]);
        return res.rows.map((row) => Stat.from(frenchMonth(row["num"]), row["value"]));
    }

    /**
     * @param {string} userId
     * @returns {Promise<number>}
     */
    getTotalSeasonsByUserId = async (userId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM users_seasons
            WHERE user_id = $1
        `, [userId]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @returns Promise<Stat[]>
     */
    getNbSeasonsByUserIdGroupByMonthByCurrentYear = async (userId)  => {
        const res = await db.query(`
            SELECT EXTRACT(MONTH FROM added_at) AS num, COUNT(*) AS value
            FROM users_seasons
            WHERE users_seasons.user_id = $1 AND EXTRACT (YEAR FROM added_at) = EXTRACT (YEAR FROM CURRENT_DATE)
            GROUP BY num
            ORDER BY num
        `, [userId]);
        return res.rows.map((row) => Stat.from(frenchMonth(row["num"]), row["value"]));
    }

    /**
     * @param {string} userId
     * @param {number} limit
     * @returns Promise<Stat[]>
     */
    getPlatformsByUserId = async (userId, limit = 10) => {
        const res = await db.query(`
            SELECT name as label, COUNT(*) AS value
            FROM users_seasons us
            JOIN platforms p ON p.id = us.platform_id
            WHERE us.user_id = $1
            GROUP BY name
            ORDER BY value DESC
            LIMIT $2
        `, [userId, limit]);
        return res.rows.map((row) => new Stat(row));
    }

    /**
     * @param {string} userId
     * @returns Promise<number>
     */
    getPlatformsCountByUserId = async (userId) => {
        const res = await db.query(`
            SELECT COUNT(DISTINCT platform_id) AS total
            FROM users_seasons
            WHERE user_id = $1 AND platform_id IS NOT NULL
        `, [userId]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @returns {Promise<number>} the highest number of times the user has watched any single season
     */
    getMaxRewatchCountByUserId = async (userId) => {
        const res = await db.query(`
            SELECT MAX(cnt) AS max_count
            FROM (
                SELECT COUNT(*) AS cnt
                FROM users_seasons
                WHERE user_id = $1
                GROUP BY show_id, number
            ) sub
        `, [userId]);
        return parseInt(res.rows[0]["max_count"] ?? 0);
    }

    /**
     * @param {string} userId
     * @returns {Promise<{showTitle: string, seasonNumber: number, timesWatched: number}|null>}
     */
    getMostRewatchedByUserId = async (userId) => {
        const res = await db.query(`
            SELECT s.title AS show_title, us.number AS season_number, COUNT(*) AS times_watched
            FROM users_seasons us
            JOIN shows s ON s.id = us.show_id
            WHERE us.user_id = $1
            GROUP BY s.id, s.title, us.number
            HAVING COUNT(*) > 1
            ORDER BY times_watched DESC
            LIMIT 1
        `, [userId]);
        return res.rowCount === 1 ? {
            showTitle: res.rows[0]["show_title"],
            seasonNumber: parseInt(res.rows[0]["season_number"]),
            timesWatched: parseInt(res.rows[0]["times_watched"]),
        } : null;
    }

}