const axios = require('axios');
const config = require('../config/config.json');
const { getGoogleAuthUrl, getTokens, signJwt } = require('../helpers/security');
const userRepository = require('../repositories/userRepository');

const googleAuthentication = (_, res) => {
    try {
        res.redirect(getGoogleAuthUrl());
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const googleAuthenticationCallback = async (req, res) => {
    try {
        const code = req.query.code;

        const { id_token, access_token } = await getTokens(
            code,
            config.GOOGLE_CLIENT,
            config.GOOGLE_SECRET,
            `${config.HOST}/api/auth/google/callback`,
        );

        const resp = await axios.get(
            `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
            {
                headers: {
                    Authorization: `Bearer ${id_token}`,
                },
            }
        );
        const googleUser = await resp.data;
        const result = await userRepository.getUserByEmail(googleUser.email);

        if (result.rowCount === 0) {
            await userRepository.createUser(
                googleUser.id,
                googleUser.email,
                googleUser.name
            );
        }
        const token = signJwt(googleUser, config.JWT_SECRET);

        res.redirect(`${config.ORIGIN}?token=${token}`);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getUser = async (req, res) => {
    try {
        const resp = await userRepository.getUserById(req.user.id);

        if (resp.rowCount === 1) {
            res.status(200).json(resp['rows'][0]);
        } else {
            res.sendStatus(400);
        }
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

module.exports = { googleAuthentication, googleAuthenticationCallback, getUser };