const { Router } = require('express');
const { checkJwt } = require('../middlewares/guard');
const authService = require('../services/authService');

const router = Router();

router.get('/google', authService.googleAuthentication);

router.get('/google/callback', authService.googleAuthenticationCallback);

router.get('/me', checkJwt, authService.getUser);

module.exports = router;