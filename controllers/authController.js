const { Router } = require('express');
const { checkJwt } = require('../middlewares/guard');
const authService = require('../services/authService');

const router = Router();

router.post('/register', authService.register);

router.post('/login', authService.login);

router.get('/me/profile', checkJwt, authService.getProfile);

router.get('/me', checkJwt, authService.checkUser);

module.exports = router;