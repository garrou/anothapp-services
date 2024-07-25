const betaseries = "https://api.betaseries.com";
const key = process.env.BETASERIES_KEY;
const axios = require("axios");
const ApiShow = require("../models/ApiShow");
const ApiEpisode = require("../models/ApiEpisode");
const Season = require("../models/Season");
const ApiCharacter = require("../models/ApiCharacter");
const ApiSimilarShow = require("../models/ApiSimilarShow");
const ApiShowKind = require("../models/ApiShowKind");
const ApiPerson = require("../models/ApiPerson");
const { cumulate } = require("../helpers/utils");
const platformRepository = require("../repositories/platformRepository");
const Platform = require("../models/Platform");

/**
 * @param {string?} title 
 * @param {limit} limit
 * @returns ApiShow[]
 */
const getShowsByTitle = async (title, limit = 20) => {
    const url = title
        ? `${betaseries}/shows/search?title=${title}`
        : `${betaseries}/shows/discover?limit=${limit}`;
    const resp = await axios.get(url, {
        headers: {
            "X-BetaSeries-Key": key
        }
    });
    const { shows } = await resp.data;
    return shows.map(show => new ApiShow(show));
}

/**
 * @param {string} kind 
 * @returns any[]
 */
const getShowsByKind = async (kind) => {
    const resp = await axios.get(`${betaseries}/search/shows?genres=${kind}`, {
        headers: {
            "X-BetaSeries-Key": key
        }
    });
    const { shows } = await resp.data;
    return shows.map(s => ({
        id: s.id,
        title: s.title,
        poster: s.poster
    }));
}

const getImages = async (req, res) => {
    try {
        const shows = await getShowsByTitle(null, 8);
        res.status(200).json(shows.map((s) => s.poster)); 
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const discoverShows = async (req, res) => {
    try {
        const { title, kind } = req.query;
        let response = null;

        if (kind) {
            response = await getShowsByKind(kind);
        } else {
            response = await getShowsByTitle(title);
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
        const mapSeasons = seasons.map((s, i) => new Season({
            ...s,
            interval: `${episodes[i] + 1} - ${episodes[i + 1]}`,
        }));
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
        res.status(200).json(similars.map(similar => new ApiSimilarShow(similar)));
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
    getShowsByKind,
    discoverShows,
    getSeasonsByShowId,
    getSimilarsByShowId
};