const { getImageUrl } = require('../dto/show/image');
const userSeasonRepository = require('../repositories/userSeasonRepository');
const userShowRepository = require('../repositories/userShowRepository');
const seasonRepository = require('../repositories/seasonRepository');
const showRepository = require('../repositories/showRepository');

const addShow = async (req, res) => {
    try {
        const { id, title, images } = req.body;
        let result = await userShowRepository.getByUserIdByShowId(req.user.id, id);

        if (result.rowCount === 1) {
            return res.status(409).json({ 'message': 'Cette série est déjà dans votre collection' });
        }
        result = await showRepository.getById(id);

        if (result.rowCount === 0) {
            await showRepository.create(id, title, getImageUrl(images));
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
        const resp = await userShowRepository.getShowsByUserId(req.user.id);
        res.status(200).json(resp['rows']);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getByShowId = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getByUserIdByShowId(req.user.id, req.params.id);
        res.status(200).json(resp['rows'][0]);
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
        const result = await seasonRepository.getByShowIdByNumber(req.params.id, number);
        let created = null;

        if (result.rowCount === 0) {
            created = await seasonRepository.create(episode, number, image, req.params.id, duration);
        }
        await userSeasonRepository.create(req.user.id, req.params.id, number);

        res.status(201).json(result.rowCount === 1 ? result['rows'][0] : created);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getSeasonsByShowId = async (req, res) => {
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
        res.status(200).json(resp['rows']);
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

module.exports = {
    addSeasonByShowId,
    addShow,
    deleteByShowId,
    getViewingTimeByShowId,
    getViewingTimeByShowIdBySeason,
    getSeasonInfosByShowIdBySeason,
    getSeasonsByShowId,
    getByShowId,
    getByTitle,
    getShows
};