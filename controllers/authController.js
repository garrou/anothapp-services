const { Router } = require('express');
const { checkJwt } = require('../middlewares/guard');
const authService = require('../services/authService');

const router = Router();

router.post('/register', authService.register);

router.post('/login', authService.login);

router.get('/me', checkJwt, authService.getUser);

module.exports = router;