const axios = require('axios');

const betaseries = 'https://api.betaseries.com';
const key = process.env.BETASERIES_KEY;

const search = async (title) => {
    const resp = title 
            ? await axios.get(`${betaseries}/shows/search?title=${title}&key=${key}`)
            : await axios.get(`${betaseries}/shows/discover?limit=32&key=${key}`);
    const { shows } = await resp.data;
    
    return shows.map(s => ({
        id: s.id, 
        title: s.title, 
        images: s.images,
        duration: s.length
    }));
}

const discoverShows = async (req, res) => {
    try {
        const { title } = req.query;
        res.status(200).json(await search(title));
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getByShowId = async (req, res) => {
    try {
        const { showId } = req.params;
        const resp = await axios.get(`${betaseries}/shows/display?id=${showId}&key=${key}`);
        const { show: 
            { id, title, description, seasons, episodes, length, network, notes, images, status, creation, genres } 
        } = await resp.data;
        res.status(200).json({
            id: id,
            title: title,
            description: description,
            seasons: seasons,
            episodes: episodes,
            duration: length,
            network: network,
            note: notes.mean,
            images: images,
            status: status,
            creation: creation,
            kinds: Object.values(genres)
        });
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getSeasonsByShowId = async (req, res) => {
    try {
        const { showId } = req.params;
        const resp = await axios.get(`${betaseries}/shows/seasons?id=${showId}&key=${key}`);
        const { seasons } = await resp.data;
        const previews = seasons.map(s => ({number: s.number, episode: s.episodes, image: s.image}));
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
        const previews = episodes.map(e => ({
            id: e.id, 
            title: e.title, 
            code: e.code, 
            description: e.description, 
            date: e.date
        }));
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
        const previews = characters.map(c => ({id: c.id, name: c.name, actor: c.actor, picture: c.picture}));
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
        const previews = similars.map(s => ({ id: s.show_id, title: s.show_title }));
        res.status(200).json(previews);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
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
        res.status(500).json({ 'message': 'Une erreur est survenue' });
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