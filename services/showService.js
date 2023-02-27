const { getImageUrl } = require('../dto/show/image');
const userSeasonRepository = require('../repositories/userSeasonRepository');
const userShowRepository = require('../repositories/userShowRepository');
const seasonRepository = require('../repositories/seasonRepository');
const showRepository = require('../repositories/showRepository');

const prisma = new PrismaClient();

const addShow = async (req, res) => {
    try {
        const { id, title, images } = req.body;
        const nbUserShow = await userShowRepository.countByUserIdByShowId(req.user.id, id)['rows'][0].nb;

        if (nbUserShow === 1) {
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
        const res = await userShowRepository.getShows(req.user.id);
        
        console.log(res);

        res.status(200).json({});
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getByShowId = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const resp = await userSeasonRepository.getByUserIdByShowId(req.user.id, id);

        console.log(resp);
        res.status(200).json({});
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getByTitle = async (req, res) => {
    try {
        const { title } = req.params;
        const resp = await userShowRepository.getShowsByUserIdByTitle(req.user.id, title);
        
        console.log(resp);
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
        const data = await prisma.userSeason.findMany({
            where: {
                showId: Number(id),
                userId: req.user.id,
            },
            distinct: ['number'],
            include: { season: true },
            orderBy: { number: 'asc' }
        });
        const seasons = data.map(s => s.season);

        res.status(200).json(seasons);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getSeasonInfosByShowIdBySeason = async (req, res) => {
    try {
        const { id, num } = req.params;
        const seasonInfos = await prisma.userSeason.findMany({
            where: {
                showId: Number(id),
                userId: req.user.id,
                number: Number(num)
            },
            select: {
                id: true,
                addedAt: true
            }
        });

        res.status(200).json(seasonInfos);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getViewingTimeByShowId = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const seasons = await prisma.userSeason.findMany({
            where: {
                showId: id,
                userId: req.user.id
            },
            include: { season: true }
        });
        const viewingTime = seasons
            .reduce((acc, s) => s.season.episode * s.season.epDuration + acc, 0);

        res.status(200).json(viewingTime);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getViewingTimeByShowIdBySeason = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const num = Number(req.params.num);

        const seasons = await prisma.userSeason.findMany({
            where: {
                showId: id,
                userId: req.user.id,
                number: num
            },
            include: { season: true }
        });
        const viewingTime = seasons
            .reduce((acc, s) => s.season.episode * s.season.epDuration + acc, 0);

        res.status(200).json(viewingTime);
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