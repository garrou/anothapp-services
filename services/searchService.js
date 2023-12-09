const axios = require("axios");
const betaseries = "https://api.betaseries.com";
const key = process.env.BETASERIES_KEY;
const ApiShowDetails = require("../models/ApiShowDetails");
const ApiEpisode = require("../models/ApiEpisode");
const ApiSeason = require("../models/ApiSeason");
const ApiCharacter = require("../models/ApiCharacter");
const ApiSimilarShow = require("../models/ApiSimilarShow");
const ApiShowKind = require("../models/ApiShowKind");

const search = async (title) => {
    const resp = title
        ? await axios.get(`${betaseries}/shows/search?title=${title}&key=${key}`)
        : await axios.get(`${betaseries}/shows/discover?limit=20&key=${key}`);
    const { shows } = await resp.data;
    return shows.map(show => new ApiShowDetails(show));
}

const discoverShows = async (req, res) => {
    try {
        const { title } = req.query;
        res.status(200).json(await search(title));
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getByShowId = async (req, res) => {
    try {
        const { showId } = req.params;
        const resp = await axios.get(`${betaseries}/shows/display?id=${showId}&key=${key}`);
        const { show } = await resp.data;
        res.status(200).json(new ApiShowDetails(show));
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getSeasonsByShowId = async (req, res) => {
    try {
        const { showId } = req.params;
        const resp = await axios.get(`${betaseries}/shows/seasons?id=${showId}&key=${key}`);
        const { seasons } = await resp.data;
        res.status(200).json(seasons.map(season => new ApiSeason(season)));
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getEpisodesByShowIdBySeason = async (req, res) => {
    try {
        const { showId, num } = req.params;
        const resp = await axios.get(`${betaseries}/shows/episodes?id=${showId}&season=${num}&key=${key}`);
        const { episodes } = await resp.data;
        res.status(200).json(episodes.map(episode => new ApiEpisode(episode)));
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getCharactersByShowId = async (req, res) => {
    try {
        const { showId } = req.params;
        const resp = await axios.get(`${betaseries}/shows/characters?id=${showId}&key=${key}`);
        const { characters } = await resp.data;
        res.status(200).json(characters.map(character => new ApiCharacter(character)));
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getSimilarsByShowId = async (req, res) => {
    try {
        const { showId } = req.params;
        const resp = await axios.get(`${betaseries}/shows/similars?id=${showId}&key=${key}`);
        const { similars } = await resp.data;
        res.status(200).json(similars.map(similar => new ApiSimilarShow(similar)));
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getKinds = async (_, res) => {
    try {
        const resp = await axios.get(`${betaseries}/shows/genres?key=${key}`);
        const { genres } = await resp.data;
        const kinds = Object.entries(genres)
            .map(entry => new ApiShowKind(entry))
            .sort((a, b) => a.name.localeCompare(b.name));
        res.status(200).json(kinds);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getShowsByKind = async (req, res) => {
    try {
        const { kind } = req.params;
        const resp = await axios.get(`${betaseries}/search/shows?genres=${kind}&key=${key}`);
        const { shows } = await resp.data;
        const previews = shows.map(s => ({
            id: s.id,
            title: s.title,
            images: {
                poster: s.poster,
                show: null,
                banner: null,
                box: null
            }
        }));

        res.status(200).json(previews);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getImagesByShowId = async (req, res) => {
    try {
        const { showId } = req.params;
        const resp = await axios.get(`${betaseries}/shows/pictures?id=${showId}&key=${key}`);
        const { pictures } = await resp.data;
        res.status(200).json(pictures.map(p => p.url));
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = {
    getCharactersByShowId,
    getEpisodesByShowIdBySeason,
    getByShowId,
    getImagesByShowId,
    getKinds,
    getShowsByKind,
    discoverShows,
    getSeasonsByShowId,
    getSimilarsByShowId,
    search
};