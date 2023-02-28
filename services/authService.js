const axios = require('axios');
const { getGoogleAuthUrl, getTokens, signJwt } = require('../helpers/security');
const userRepository = require('../repositories/userRepository');
const { User } = require('../models/user');

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
            process.env.GOOGLE_CLIENT,
            process.env.GOOGLE_SECRET,
            `${process.env.HOST}/api/auth/google/callback`,
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
        const result = await userRepository.getByEmail(googleUser.email);

        if (result.rowCount === 0) {
            await userRepository.create(
                googleUser.id,
                googleUser.email,
                googleUser.name
            );
        }
        const token = signJwt(googleUser, process.env.JWT_SECRET);

        res.cookie(process.env.COOKIE, token);
        res.redirect(`${process.env.ORIGIN}/series`);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

const getUser = async (req, res) => {
    try {
        const resp = await userRepository.getById(req.user.id);

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