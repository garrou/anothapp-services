const axios = require('axios');
const { PreviewShowDto } = require('../dto/show/preview');
const { DetailsShowDto } = require('../dto/show/details');
const { PreviewSeasonDto } = require('../dto/season/preview');
const { PreviewCharacterDto } = require('../dto/character/preview');
const { SimilarShowDto } = require('../dto/show/similar');
const { PreviewEpisodeDto } = require('../dto/episode/preview');
const { SimpleShowDto } = require('../dto/show/simple');

const betaseries = 'https://api.betaseries.com';
const key = process.env.BETASERIES_KEY;

const discover = async (_, res) => {
    try {
        const resp = await axios.get(`${betaseries}/shows/discover?limit=32&key=${key}`);
        const { shows } = await resp.data;
        const previews = shows.map(s => new PreviewShowDto(s.id, s.title, s.images, s.length));

        res.status(200).json(previews);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getShowsByTitle = async (req, res) => {
    try {
        const { title } = req.params;
        const resp = await axios.get(`${betaseries}/shows/search?title=${title}&key=${key}`);
        const { shows } = await resp.data;
        const previews = shows.map(s => new PreviewShowDto(s.id, s.title, s.images, s.length));

        res.status(200).json(previews);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getByShowId = async (req, res) => {
    try {
        const { showId } = req.params;
        const resp = await axios.get(`${betaseries}/shows/display?id=${showId}&key=${key}`);
        const { show: { id, title, description, seasons, episodes, length, network, notes, images, status, creation } } = await resp.data;
        const details = new DetailsShowDto(id, title, description, seasons, episodes, length, network, notes.mean, images, status, creation);

        res.status(200).json(details);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getSeasonsByShowId = async (req, res) => {
    try {
        const { showId } = req.params;
        const resp = await axios.get(`${betaseries}/shows/seasons?id=${showId}&key=${key}`);
        const { seasons } = await resp.data;
        const previews = seasons.map(s => new PreviewSeasonDto(s.number, s.episodes, s.image));

        res.status(200).json(previews);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getEpisodesByShowIdBySeason = async (req, res) => {
    try {
        const { showId, num } = req.params;
        const resp = await axios.get(`${betaseries}/shows/episodes?id=${showId}&season=${num}&key=${key}`);
        const { episodes } = await resp.data;
        const previews = episodes.map(e => new PreviewEpisodeDto(e.id, e.title, e.code, e.description, e.date));

        res.status(200).json(previews);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getCharactersByShowId = async (req, res) => {
    try {
        const { showId } = req.params;
        const resp = await axios.get(`${betaseries}/shows/characters?id=${showId}&key=${key}`);
        const { characters } = await resp.data;
        const previews = characters.map(c => new PreviewCharacterDto(c.id, c.name, c.actor, c.picture));

        res.status(200).json(previews);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getSimilarsByShowId = async (req, res) => {
    try {
        const { showId } = req.params;
        const resp = await axios.get(`${betaseries}/shows/similars?id=${showId}&key=${key}`);
        const { similars } = await resp.data;
        const previews = similars.map(s => new SimilarShowDto(s.show_id, s.show_title));

        res.status(200).json(previews);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue '});
    }
}

const getKinds = async (_, res) => {
    try {
        const resp = await axios.get(`${betaseries}/shows/genres?key=${key}`);
        const { genres } = await resp.data;

        res.status(200).json(genres);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getShowsByKind = async (req, res) => {
    try {
        const { kind } = req.params;
        const resp = await axios.get(`${betaseries}/search/shows?genres=${kind}&key=${key}`);
        const { shows } = await resp.data;
        const previews = shows.map(s => new SimpleShowDto(s.id, s.title, s.poster));
        
        res.status(200).json(previews);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue '});
    }
}

const getImagesByShowId = async (req, res) => {
    try {
        const { showId } = req.params;
        const resp = await axios.get(`${betaseries}/shows/pictures?id=${showId}&key=${key}`);
        const { pictures } = await resp.data;
        const urls = pictures.map(p => p.url);

        res.status(200).json(urls);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

module.exports = { 
    discover, 
    getCharactersByShowId,
    getEpisodesByShowIdBySeason, 
    getByShowId,
    getImagesByShowId,
    getKinds,
    getShowsByKind,
    getShowsByTitle, 
    getSeasonsByShowId,
    getSimilarsByShowId
};