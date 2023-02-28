const userSeasonRepository = require('../repositories/userSeasonRepository');
const userShowRepository = require('../repositories/userShowRepository');

const getNbShows = async (req, res) => {
    try {
        const result = await userShowRepository.getByUserId(req.user.id);

        res.status(200).json(result.rowCount);
    } catch (_) {
        res.status(500).json({ 'message' : 'Une erreur est survenue '});
    }
}

const getTotalTime = async (req, res) => {
    try {
        const viewingTime = await userSeasonRepository.getTotalTimeByUserId(req.user.id)['rows'][0].time;

        res.status(200).json(viewingTime);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getSeasonsByYears = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getNbSeasonsByUserIdGroupByYear(req.user.id);

        console.log(resp['rows']);
        res.status(200).json({});
    } catch (err) {
        console.log(err);
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getTimeByYears = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getTimeHourByUserIdGroupByYear(req.user.id);

        console.log(resp['rows']);
        res.status(200).json({});
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getTimeCurrentMonth = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getTimeCurrentMonthByUserId(req.user.id);
        console.log(resp['rows']);
        res.status(200).json({});
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue '});
    }
}

const getNbSeasonsByMonth = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getNbSeasonsByUserIdGroupByMonth(req.user.id);
        console.log(resp['rows']);
        res.status(200).json({});
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue '});
    }
}

const getNbEpisodesByYear = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getNbEpisodesByUserIdGroupByYear(req.user.id);
        console.log(resp['rows']);

        res.status(200).json({});
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue '});
    }
}

const getNbEpisodes = async (req, res) => {
    try {
        const resp = await userSeasonRepository.getTotalEpisodesByUserId(req.user.id);
        console.log(resp['rows']);

        res.status(200).json({});
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

module.exports = {
    getNbEpisodes,
    getNbEpisodesByYear,
    getNbShows,
    getNbSeasonsByMonth,
    getSeasonsByYears,
    getTimeByYears,
    getTimeCurrentMonth,
    getTotalTime,
}