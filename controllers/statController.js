const { Router } = require('express');
const statService = require('../services/statService');

const router = Router();

router.get('/count/shows', statService.getNbShows);

router.get('/time', statService.getTotalTime);

router.get('/seasons/years', statService.getSeasonsByYears);

router.get('/time/years', statService.getTimeByYears);

router.get('/time/month', statService.getTimeCurrentMonth);

router.get('/time/month-best', statService.getRecordTimeMonth);

router.get('/seasons/months', statService.getNbSeasonsByMonth);

router.get('/episodes/years', statService.getNbEpisodesByYear);

router.get('/count/episodes', statService.getNbEpisodes);

router.get('/shows/ranking', statService.getRankingTimeShows);

module.exports = router;