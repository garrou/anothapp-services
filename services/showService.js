const { getImageUrl } = require('../dto/show/image');
const userSeasonRepository = require('../repositories/userSeasonRepository');
const userShowRepository = require('../repositories/userShowRepository');
const seasonRepository = require('../repositories/seasonRepository');
const showRepository = require('../repositories/showRepository');

const addShow = async (req, res) => {
    try {
        const { id, title, images } = req.body;
        const result = await userShowRepository.getByUserIdByShowId(req.user.id, id);

        if (result.rowCount === 1) {
            return res.status(409).json({ 'message': 'Cette série est déjà dans votre collection' });
        }
        const nbShow = await showRepository.countById(id)['rows'][0].nb;

        if (nbShow === 0) {
            await showRepository.create(id, title, getImageUrl(images));
        }
        await userShowRepository.create(req.user.id, id);
        
        res.sendStatus(201);
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
        const resp = await userShowRepository.getShows(req.user.id);
        
        console.log(resp['rows']);

        res.status(200).json({});
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getByShowId = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const resp = await userSeasonRepository.getByUserIdByShowId(req.user.id, id);

        console.log(resp['rows']);
        res.status(200).json({});
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getByTitle = async (req, res) => {
    try {
        const { title } = req.params;
        const resp = await userShowRepository.getShowsByUserIdByTitle(req.user.id, title);
        
        console.log(resp['rows']);
        res.status(200).json({});
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const addSeasonByShowId = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { number, episode, image, duration } = req.body;
        const nbSeason = await seasonRepository.getByShowIdByNumber(id, number)['rows'][0].nb;
        let created = null;

        if (nbSeason === 0) {
            created = await seasonRepository.create(episode, number, image, id, duration);
        }
        await userSeasonRepository.create(req.user.id, id, number);

        res.status(201).json(exists ? exists : created);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getSeasonsByShowId = async (req, res) => {
    try {
        const { id } = req.params;
        const resp = await userSeasonRepository.getDistinctByUserIdByShowId(req.user.id, id);
        
        console.log(resp['rows']);

        res.status(200).json({});
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getSeasonInfosByShowIdBySeason = async (req, res) => {
    try {
        const { id, num } = req.params;
        const resp = await userSeasonRepository.getInfos(req.user.id, id, num);

        console.log(resp['rows']);

        res.status(200).json({});
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getViewingTimeByShowId = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getViewingTimeByUserIdByShowId(req.user.id, req.params.id);

        console.log(resp['rows']);
        res.status(200).json({});
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getViewingTimeByShowIdBySeason = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getViewingTimeByUserIdByShowIdByNumber(req.user.id, req.params.id, req.params.num);
        
        console.log(resp['rows']);

        res.status(200).json({});
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