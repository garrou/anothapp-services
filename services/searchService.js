const axios = require("axios");
const betaseries = "https://api.betaseries.com";
const key = process.env.BETASERIES_KEY;
const ApiShow = require("../models/ApiShow");
const ApiEpisode = require("../models/ApiEpisode");
const Season = require("../models/Season");
const ApiCharacter = require("../models/ApiCharacter");
const ApiSimilarShow = require("../models/ApiSimilarShow");
const ApiShowKind = require("../models/ApiShowKind");
const ApiPerson = require("../models/ApiPerson");
const { cumulate } = require("../helpers/utils");

/**
 * @param {string} title 
 * @returns ApiShow[]
 */
const search = async (title) => {
    const url = title
        ? `${betaseries}/shows/search?title=${title}`
        : `${betaseries}/shows/discover?limit=20`;
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

const discoverShows = async (req, res) => {
    try {
        const { title, kind } = req.query;
        let response = null;

        if (kind) {
            response = await getShowsByKind(kind);
        } else {
            response = await search(title);
        }
        res.status(200).json(response);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
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
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
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
        const mapSeasons = seasons.map((s, i) => {
            const season = new Season(s);
            season.interval = `${episodes[i] + 1} - ${episodes[i + 1]}`;
            return season;
        });
        res.status(200).json(mapSeasons);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
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
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
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
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
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
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
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
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
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
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
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
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue " });
    }
}

module.exports = {
    getCharactersByShowId,
    getEpisodesByShowIdBySeason,
    getByShowId,
    getImagesByShowId,
    getKinds,
    getPersonById,
    getShowsByKind,
    discoverShows,
    getSeasonsByShowId,
    getSimilarsByShowId,
    search
};