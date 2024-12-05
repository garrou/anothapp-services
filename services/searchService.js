const betaseries = "https://api.betaseries.com";
const key = process.env.BETASERIES_KEY;
const axios = require("axios");
const { ApiShow, ApiShowPreview } = require("../models/ApiShow");
const ApiEpisode = require("../models/ApiEpisode");
const Season = require("../models/Season");
const ApiCharacter = require("../models/ApiCharacter");
const ApiEntity = require("../models/ApiEntity");
const ApiShowKind = require("../models/ApiShowKind");
const ApiPerson = require("../models/ApiPerson");
const { cumulate } = require("../helpers/utils");
const platformRepository = require("../repositories/platformRepository");
const Platform = require("../models/Platform");
const { buildUrlWithParams, fetchPromises, Param, buildLimit } = require("../helpers/fetch");

/**
 * @param {limit} limit
 * @returns Promise<ApiShow[]>
 */
const getShowsToDiscover = async (limit) => {
    const allShows = [];
    const url = buildUrlWithParams(`${betaseries}/shows/discover`, [
        new Param("limit", limit)
    ]);
    const results = await Promise.all(fetchPromises(url, "offset", limit));
    for (const result of results) {
        const { shows } = result.data;
        allShows.push(...shows.map(show => new ApiShow(show)));
    }
    return allShows;
}

/**
 * 
 * @param {string?} title 
 * @param {string?} platforms 
 * @param {number} limit
 * @returns Promise<ApiShow[]>
 */
const getShowsByFilters = async (title, platforms, limit) => {
    const allShows = [];
    const url = buildUrlWithParams(`${betaseries}/shows/search`, [
        new Param("title", title),
        new Param("platforms", platforms),
        new Param("nbpp", limit)
    ]);
    const results = await Promise.all(fetchPromises(url, "page", limit));
    for (const result of results) {
        const { shows } = result.data;
        allShows.push(...shows.map((s) => new ApiShow(s)));
    }
    return allShows;
}

/**
 * @param {string?} title
 * @param {string?} kinds
 * @param {number?} year
 * @param {string?} platforms
 * @param {number} limit
 * @returns Promise<ApiShowPreview[]>
 */
const getShowsPreviewByFilters = async (title, kinds, year, platforms, limit) => {
    const allShows = [];
    const url = buildUrlWithParams(`${betaseries}/search/shows`, [
        new Param("text", title),
        new Param("genres", kinds),
        new Param("limit", limit),
        new Param("svods", platforms),
        new Param("creations", year)
    ]);
    const results = await Promise.all(fetchPromises(url, "offset", limit));
    for (const result of results) {
        const { shows } = result.data;
        allShows.push(...shows.map((s) => new ApiShowPreview(s)));
    }
    return allShows;
}

const getImages = async (req, res) => {
    try {
        const { limit } = req.query;
        const shows = await getShowsToDiscover(buildLimit(limit));
        res.status(200).json(shows.map((s) => s.poster));
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getShows = async (req, res) => {
    try {
        const { title, kinds, platforms, limit, year } = req.query;
        const numLimit = buildLimit(limit);
        let response = null;

        if (Object.keys(req.query).length > 1) {
            response = await getShowsPreviewByFilters(title, kinds, year, platforms, numLimit);
        } else {
            response = await getShowsToDiscover(numLimit);
        }
        res.status(200).json(response);
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getByShowId = async (req, res) => {
    try {
        const { showId } = req.params;

        if (!showId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const resp = await axios.get(`${betaseries}/shows/display?id=${showId}`, {
            headers: {
                "X-BetaSeries-Key": key
            }
        });
        const { show } = await resp.data;
        res.status(200).json(new ApiShow(show));
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getSeasonsByShowId = async (req, res) => {
    try {
        const { showId } = req.params;

        if (!showId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const resp = await axios.get(`${betaseries}/shows/seasons?id=${showId}`, {
            headers: {
                "X-BetaSeries-Key": key
            }
        });
        const { seasons } = await resp.data;
        const episodes = cumulate(seasons);
        const mapSeasons = seasons.map((s, i) => new Season(s, `${episodes[i] + 1} - ${episodes[i + 1]}`));
        res.status(200).json(mapSeasons);
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getEpisodesByShowIdBySeason = async (req, res) => {
    try {
        const { showId, num } = req.params;

        if (!showId || !num) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const resp = await axios.get(`${betaseries}/shows/episodes?id=${showId}&season=${num}`, {
            headers: {
                "X-BetaSeries-Key": key
            }
        });
        const { episodes } = await resp.data;
        res.status(200).json(episodes.map(episode => new ApiEpisode(episode)));
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getCharactersByShowId = async (req, res) => {
    try {
        const { showId } = req.params;

        if (!showId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const resp = await axios.get(`${betaseries}/shows/characters?id=${showId}`, {
            headers: {
                "X-BetaSeries-Key": key
            }
        });
        const { characters } = await resp.data;
        res.status(200).json(characters.map(character => new ApiCharacter(character)));
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getSimilarsByShowId = async (req, res) => {
    try {
        const { showId } = req.params;

        if (!showId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const resp = await axios.get(`${betaseries}/shows/similars?id=${showId}`, {
            headers: {
                "X-BetaSeries-Key": key
            }
        });
        const { similars } = await resp.data;
        res.status(200).json(similars.map((s) => new ApiEntity(s.show_id, s.show_title)));
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getKinds = async (_, res) => {
    try {
        const resp = await axios.get(`${betaseries}/shows/genres`, {
            headers: {
                "X-BetaSeries-Key": key
            }
        });
        const { genres } = await resp.data;
        const kinds = Object.entries(genres)
            .map(entry => new ApiShowKind(entry))
            .sort((a, b) => a.name.localeCompare(b.name));
        res.status(200).json(kinds);
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getImagesByShowId = async (req, res) => {
    try {
        const { showId } = req.params;

        if (!showId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const resp = await axios.get(`${betaseries}/shows/pictures?id=${showId}`, {
            headers: {
                "X-BetaSeries-Key": key
            }
        });
        const { pictures } = await resp.data;
        res.status(200).json(pictures.map(p => p.url));
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getPersonById = async (req, res) => {
    try {
        const { personId } = req.params;

        if (!personId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const resp = await axios.get(`${betaseries}/persons/person?id=${personId}`, {
            headers: {
                "X-BetaSeries-Key": key
            }
        });
        const { person } = await resp.data;
        res.status(200).json(new ApiPerson(person));
    } catch (e) {
        res.status(500).json({ "message": "Une erreur est survenue " });
    }
}

const getPlatforms = async (req, res) => {
    try {
        const rows = await platformRepository.getPlatforms();
        res.status(200).json(rows.map((row) => new Platform(row)));
    } catch (e) {
        res.status(500).json({ "message": "Une erreur est survenue " });
    }
}

module.exports = {
    getByShowId,
    getCharactersByShowId,
    getEpisodesByShowIdBySeason,
    getPlatforms,
    getImages,
    getImagesByShowId,
    getKinds,
    getPersonById,
    getShows,
    getSeasonsByShowId,
    getSimilarsByShowId
};