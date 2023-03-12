const { getImageUrl } = require('../helpers/image');
const axios = require('axios');
const userSeasonRepository = require('../repositories/userSeasonRepository');
const userShowRepository = require('../repositories/userShowRepository');
const userWatchRepository = require('../repositories/userWatchRepository');
const seasonRepository = require('../repositories/seasonRepository');
const showRepository = require('../repositories/showRepository');

const betaseries = 'https://api.betaseries.com';
const key = process.env.BETASERIES_KEY;

const addShow = async (req, res) => {
    try {
        const { id, title, images } = req.body;
        let result = await userShowRepository.getShowByUserIdByShowId(req.user.id, id);

        if (result.rowCount === 1) {
            return res.status(409).json({ 'message': 'Cette série est déjà dans votre collection' });
        }
        result = await showRepository.getShowById(id);

        if (result.rowCount === 0) {
            await showRepository.createShow(id, title, getImageUrl(images));
        }
        await userShowRepository.create(req.user.id, id);
        
        res.status(201).json({
            'id': id,
            'title': title,
            'poster': getImageUrl(images),
        });
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const deleteByShowId = async (req, res) => {
    try {
        const { id } = req.params;
        await userShowRepository.deleteByUserIdShowId(req.user.id, id);

        res.sendStatus(204);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getShows = async (req, res) => {
    try {
        const { limit } = req.query;
        const resp = await userShowRepository.getShowsByUserId(req.user.id, limit);
        res.status(200).json(resp['rows']);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getByTitle = async (req, res) => {
    try {
        const { title } = req.params;
        const resp = await userShowRepository.getShowsByUserIdByTitle(req.user.id, title);
        res.status(200).json(resp['rows']);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const addSeasonByShowId = async (req, res) => {
    try {
        const { number, episode, image, duration } = req.body;
        const result = await seasonRepository.getSeasonByShowIdByNumber(req.params.id, number);
        let created = null;

        if (result.rowCount === 0) {
            created = await seasonRepository.createSeason(episode, number, image, req.params.id, duration);
        }
        await userSeasonRepository.create(req.user.id, req.params.id, number);

        res.status(201).json(result.rowCount === 1 ? result['rows'][0] : created);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getDistinctByShowId = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getDistinctByUserIdByShowId(req.user.id, req.params.id);
        res.status(200).json(resp['rows']);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getSeasonInfosByShowIdBySeason = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getInfosByUserIdByShowId(req.user.id, req.params.id, req.params.num);
        const infos = resp['rows'].map(e => ({ id: e.id, addedAt: e.added_at }));
        res.status(200).json(infos);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getViewingTimeByShowId = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getViewingTimeByUserIdByShowId(req.user.id, req.params.id);
        res.status(200).json(resp['rows'][0].time ?? 0);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getViewingTimeByShowIdBySeason = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getViewingTimeByUserIdByShowIdByNumber(req.user.id, req.params.id, req.params.num);
        res.status(200).json(resp['rows'][0].time ?? 0);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getToWatch = async (req, res) => {
    try {
        const result = await userShowRepository.getByUserIdByContinue(req.user.id, true);
        const showsToWatch = [];

        for (let obj of result['rows']) {
            let resp = await axios.get(`${betaseries}/shows/seasons?id=${obj.id}&key=${key}`);
            const { seasons } = await resp.data;
            
            if (seasons.length > obj.number) {
                showsToWatch.push(obj);
            }
        }

        res.status(200).json(showsToWatch);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getViewedCurrentMonth = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getViewedCurrentMonth(req.user.id);
        res.status(200).json(resp['rows']);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getNotStartedShows = async (req, res) => {
    try {
        const resp = await userShowRepository.getNotStartedShowsByUserId(req.user.id);
        res.status(200).json(resp['rows']);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getShowsToContinue = async (req, res) => {
    try {
        const resp = await userWatchRepository.getShowsToContinueByUserId(req.user.id);
        res.status(200).json(resp['rows']);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

module.exports = {
    addSeasonByShowId,
    addShow,
    deleteByShowId,
    getByTitle,
    getDistinctByShowId,
    getNotStartedShows,
    getToWatch,
    getSeasonInfosByShowIdBySeason,
    getShows,
    getShowsToContinue,
    getViewedCurrentMonth,
    getViewingTimeByShowId,
    getViewingTimeByShowIdBySeason
};