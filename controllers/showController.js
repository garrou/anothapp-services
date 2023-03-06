const { Router } = require('express');
const showService = require('../services/showService');

const router = Router();

router.post('/', showService.addShow);

router.get('/', showService.getShows);

router.get('/titles/:title', showService.getByTitle);

router.delete('/:id', showService.deleteByShowId);

router.post('/:id/seasons', showService.addSeasonByShowId);

router.get('/:id/seasons', showService.getDistinctByShowId);

router.get('/:id/seasons/:num', showService.getSeasonInfosByShowIdBySeason);

router.get('/:id/time', showService.getViewingTimeByShowId);

router.get('/:id/seasons/:num/time', showService.getViewingTimeByShowIdBySeason);

router.get('/watching', showService.getToWatch);

router.get('/viewed/month', showService.getViewedCurrentMonth);

router.get('/not-started', showService.getNotStartedShows);

router.get('/continue', showService.getShowsToContinue);

module.exports = router;