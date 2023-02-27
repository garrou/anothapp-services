const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const getNbShows = async (req, res) => {
    try {
        const nbShows = await prisma.userShow.count({
            where: {
                userId: req.user.id
            }
        });

        res.status(200).json(nbShows);
    } catch (_) {
        res.status(500).json({ 'message' : 'Une erreur est survenue '});
    }
}

const getTotalTime = async (req, res) => {
    try {
        const seasons = await prisma.userSeason.findMany({
            where: { userId: req.user.id },
            include: { season: true }
        });
        const viewingTime = seasons
            .reduce((acc, s) => s.season.episode * s.season.epDuration + acc, 0);

        res.status(200).json(viewingTime);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getSeasonsByYears = async (req, res) => {
    try {
        const nbSeasonsByYears = await prisma.$queryRaw`
            SELECT EXTRACT(YEAR FROM "addedAt") AS label, COUNT(*)::INT AS value
            FROM "UserSeason"
            JOIN "Season" ON "UserSeason"."showId" = "Season"."showId"
            AND "UserSeason"."number" = "Season"."number"
            WHERE "UserSeason"."userId" = ${req.user.id}
            GROUP BY label
            ORDER BY label`;

        res.status(200).json(nbSeasonsByYears);
    } catch (err) {
        console.log(err);
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getTimeByYears = async (req, res) => {
    try {
        const timeByYears = await prisma.$queryRaw`
            SELECT EXTRACT(YEAR FROM "addedAt") AS label, (SUM("epDuration" * "episode") / 60)::INT AS value
            FROM "UserSeason"
            JOIN "Season" ON "UserSeason"."showId" = "Season"."showId"
            AND "UserSeason"."number" = "Season"."number"
            WHERE "UserSeason"."userId" = ${req.user.id}
            GROUP BY label
            ORDER BY label`;

        res.status(200).json(timeByYears);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getTimeCurrentMonth = async (req, res) => {
    try {
        const timeCurrentMonth = await prisma.$queryRaw`
            SELECT SUM("epDuration" * "episode")::INT AS value
            FROM "UserSeason"
            JOIN "Season" ON "UserSeason"."showId" = "Season"."showId"
            AND "UserSeason"."number" = "Season"."number"
            WHERE "UserSeason"."userId" = ${req.user.id}
            AND "addedAt" >= DATE_TRUNC('month', CURRENT_DATE)`;

        res.status(200).json(timeCurrentMonth ? timeCurrentMonth[0].value : 0);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue '});
    }
}

const getNbSeasonsByMonth = async (req, res) => {
    try {
        const seasonsByMonths = await prisma.$queryRaw`
            SELECT EXTRACT(MONTH FROM "addedAt") AS num, TO_CHAR("addedAt", 'Mon') AS label, COUNT(*)::INT AS value
            FROM "UserSeason"
            WHERE "UserSeason"."userId" = ${req.user.id}
            GROUP BY num, label
            ORDER BY num`;

        res.status(200).json(seasonsByMonths);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue '});
    }
}

const getNbEpisodesByYear = async (req, res) => {
    try {
        const episodesByYear = await prisma.$queryRaw`
            SELECT EXTRACT(YEAR FROM "addedAt") AS label, SUM("episode")::INT AS value
            FROM "UserSeason"
            JOIN "Season" ON "UserSeason"."showId" = "Season"."showId"
            WHERE "UserSeason"."number" = "Season"."number"
            AND "UserSeason"."userId" = ${req.user.id}
            GROUP BY label
            ORDER BY label`;

        res.status(200).json(episodesByYear);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue '});
    }
}

const getNbEpisodes = async (req, res) => {
    try {
        const seasons = await prisma.userSeason.findMany({
            where: { userId: req.user.id },
            include: { season: true }
        });
        const nbEpisodes = seasons
            .reduce((acc, s) => s.season.episode + acc, 0);

        res.status(200).json(nbEpisodes);
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