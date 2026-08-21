import axios from "axios";

const BASE_URL = "https://api.betaseries.com";

/**
 * @returns {Object}
 */
const headers = () => ({"X-BetaSeries-Key": process.env.BETASERIES_KEY});

/**
 * @param {number} id
 * @returns {Promise<Object|null>} null when the show no longer exists on BetaSeries
 */
const fetchShow = async (id) => {
    const {data} = await axios.get(`${BASE_URL}/shows/display?id=${id}`, {headers: headers()});
    return Array.isArray(data.show) ? null : data.show;
};

/**
 * @param {number} id
 * @returns {Promise<Object[]>}
 */
const fetchSeasons = async (id) => {
    const {data} = await axios.get(`${BASE_URL}/shows/seasons?id=${id}`, {headers: headers()});
    return data.seasons ?? [];
};

/**
 * @param {number} id
 * @returns {Promise<string>} empty string when there is no upcoming episode
 */
const fetchNextEpisodeDate = async (id) => {
    const {data} = await axios.get(`${BASE_URL}/episodes/next?id=${id}`, {headers: headers()});
    return Array.isArray(data.episode) || !data.episode ? "" : (data.episode.date ?? "");
};

/**
 * @returns {Promise<{id: number, name: string, logo: string}[]>}
 */
const fetchPlatforms = async () => {
    const {data} = await axios.get(`${BASE_URL}/platforms/services`, {headers: headers()});
    return (data.services ?? []).filter((p) => p && p.id !== undefined);
};

export default {
    fetchShow,
    fetchSeasons,
    fetchNextEpisodeDate,
    fetchPlatforms,
};
