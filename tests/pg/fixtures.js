import db from "../../config/db.js";

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

/**
 * @param {Object} overrides
 * @returns {Promise<string>} the created user's id
 */
export const insertUser = async (overrides = {}) => {
    const suffix = unique();
    const {
        username = `user_${suffix}`,
        email = `user_${suffix}@test.fr`,
        password = "hash",
        picture = null,
        episodeTrackingEnabled = true,
        deletedAt = null,
    } = overrides;
    const res = await db.query(`
        INSERT INTO users (username, email, password, picture, episode_tracking_enabled, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
    `, [username, email, password, picture, episodeTrackingEnabled, deletedAt]);
    return res.rows[0].id;
};

let nextShowId = 1;

/**
 * @param {Object} overrides
 * @returns {Promise<number>} the created show's id
 */
export const insertShow = async (overrides = {}) => {
    const id = overrides.id ?? nextShowId++;
    const {
        title = `Show ${unique()}`,
        poster = null,
        duration = 42,
        seasons = 1,
        country = "US",
        finished = false,
        episodes = 10,
    } = overrides;
    await db.query(`
        INSERT INTO shows (id, title, poster, duration, seasons, country, finished, episodes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, title, poster, duration, seasons, country, finished, episodes]);
    return id;
};

/**
 * @param {number} showId
 * @param {number} number
 * @param {Object} overrides
 * @returns {Promise<void>}
 */
export const insertSeason = async (showId, number, overrides = {}) => {
    const { episodes = 10, image = null } = overrides;
    await db.query(`
        INSERT INTO seasons (number, episodes, image, show_id)
        VALUES ($1, $2, $3, $4)
    `, [number, episodes, image, showId]);
};

/**
 * @param {string} userId
 * @param {number} showId
 * @param {Object} overrides
 * @returns {Promise<void>}
 */
export const insertUserShow = async (userId, showId, overrides = {}) => {
    const { continueWatching = true, favorite = false, noteId = null } = overrides;
    await db.query(`
        INSERT INTO users_shows (user_id, show_id, continue, favorite, note_id)
        VALUES ($1, $2, $3, $4, $5)
    `, [userId, showId, continueWatching, favorite, noteId]);
};

/**
 * @param {string} userId
 * @param {Object} overrides
 * @returns {Promise<string>} the created playlist's id
 */
export const insertPlaylist = async (userId, overrides = {}) => {
    const { name = `Playlist ${unique()}`, visible = false } = overrides;
    const res = await db.query(`
        INSERT INTO playlists (user_id, name, visible)
        VALUES ($1, $2, $3)
        RETURNING id
    `, [userId, name, visible]);
    return res.rows[0].id;
};

let nextEpisodeId = 1;

/**
 * Requires a prior insertShow/insertSeason for the same (showId, seasonNumber).
 * @param {number} showId
 * @param {number} seasonNumber
 * @param {Object} overrides
 * @returns {Promise<number>} the created episode's id
 */
export const insertEpisode = async (showId, seasonNumber, overrides = {}) => {
    const id = overrides.id ?? nextEpisodeId++;
    const {
        number = 1,
        title = `Episode ${unique()}`,
        code = null,
        global = null,
        length = 42,
        date = null,
        description = null,
    } = overrides;
    await db.query(`
        INSERT INTO episodes (id, show_id, season_number, number, title, code, global, length, date, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [id, showId, seasonNumber, number, title, code, global, length, date, description]);
    return id;
};

/**
 * Requires a prior insertEpisode(showId, seasonNumber) and insertUserSeason(userId, showId, seasonNumber).
 * @param {string} userId
 * @param {number} userSeasonId
 * @param {number} episodeId
 * @param {Object} overrides
 * @returns {Promise<number>} the created users_episodes row id
 */
export const insertUserEpisode = async (userId, userSeasonId, episodeId, overrides = {}) => {
    const { platformId = 999, watchedAt = null } = overrides;
    const res = await db.query(`
        INSERT INTO users_episodes (user_id, users_seasons_id, episode_id, platform_id, watched_at)
        VALUES ($1, $2, $3, $4, COALESCE($5, NOW()))
        RETURNING id
    `, [userId, userSeasonId, episodeId, platformId, watchedAt]);
    return res.rows[0].id;
};

let nextActorId = 1;

/**
 * @param {Object} overrides
 * @returns {Promise<number>} the created actor's id
 */
export const insertActor = async (overrides = {}) => {
    const id = overrides.id ?? nextActorId++;
    const {
        name = `Actor ${unique()}`,
        picture = null,
        birthday = null,
        deathday = null,
        nationality = null,
        description = null,
    } = overrides;
    await db.query(`
        INSERT INTO actors (id, name, picture, birthday, deathday, nationality, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, name, picture, birthday, deathday, nationality, description]);
    return id;
};

/**
 * Requires a prior insertShow/insertSeason/insertUserShow for the same (userId, showId, number).
 * @param {string} userId
 * @param {number} showId
 * @param {number} number
 * @param {Object} overrides
 * @returns {Promise<number>} the created users_seasons row id
 */
export const insertUserSeason = async (userId, showId, number, overrides = {}) => {
    const { platformId = 999, addedAt = null } = overrides;
    const res = await db.query(`
        INSERT INTO users_seasons (user_id, show_id, number, platform_id, added_at)
        VALUES ($1, $2, $3, $4, COALESCE($5, NOW()))
        RETURNING id
    `, [userId, showId, number, platformId, addedAt]);
    return res.rows[0].id;
};
