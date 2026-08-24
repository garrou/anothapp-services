import BetaseriesClient from "../../helpers/betaseriesClient.js";

const client = new BetaseriesClient();

const seasonsCache = new Map();

/**
 * BetaSeries returns `"show": []` (an empty array instead of an object) when the id no
 * longer exists, so that's how a deleted show is detected.
 * @param {number} id
 * @returns {Promise<Object|null>} null when the show no longer exists on BetaSeries
 */
const fetchShow = async (id) => {
    const data = await client.get(`/shows/display?id=${id}`);
    return Array.isArray(data.show) ? null : data.show;
};

/**
 * @param {number} id
 * @returns {Promise<Object[]>}
 */
const fetchSeasons = async (id) => {
    if (seasonsCache.has(id)) {
        return seasonsCache.get(id);
    }
    const data = await client.get(`/shows/seasons?id=${id}`);
    const seasons = data.seasons ?? [];
    seasonsCache.set(id, seasons);
    return seasons;
};

/**
 * @param {number} showId
 * @param {number} seasonNumber
 * @returns {Promise<Object[]>}
 */
const fetchEpisodes = async (showId, seasonNumber) => {
    const data = await client.get(`/shows/episodes?id=${showId}&season=${seasonNumber}`);
    return data.episodes ?? [];
};

/**
 * @param {number} id
 * @returns {Promise<string>} empty string when there is no upcoming episode
 */
const fetchNextEpisodeDate = async (id) => {
    const data = await client.get(`/episodes/next?id=${id}`);
    return Array.isArray(data.episode) || !data.episode ? "" : (data.episode.date ?? "");
};

/**
 * @returns {Promise<{id: number, name: string, logo: string}[]>}
 */
const fetchPlatforms = async () => {
    const data = await client.get(`/platforms/services`);
    return (data.services ?? []).filter((p) => p && p.id !== undefined);
};

export default {
    fetchShow,
    fetchSeasons,
    fetchEpisodes,
    fetchNextEpisodeDate,
    fetchPlatforms,
};
