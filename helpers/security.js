const axios = require('axios');
const config = require('../config/config.json');
const jwt = require('jsonwebtoken');

/**
 * 
 * @param {any} data 
 * @param {string} secret 
 * @returns string
 */
const signJwt = (data, secret) => jwt.sign(data, secret);

/**
 * 
 * @param {string} token 
 * @param {string} secret 
 * @returns any
 */
const verifyJwt = (token, secret) => jwt.verify(token, secret);

/**
 * @returns string
 */
const getGoogleAuthUrl = () => {
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
        redirect_uri: `${config.HOST}/api/auth/google/callback`,
        client_id: config.GOOGLE_CLIENT,
        access_type: 'offline',
        response_type: 'code',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email'
        ].join(' ')
    };

    return `${rootUrl}?${new URLSearchParams(options).toString()}`;
}

/**
 * 
 * @param {string} code 
 * @param {string} clientId 
 * @param {string} clientSecret 
 * @param {string} redirectUri 
 * @returns any
 */
const getTokens = async (code, clientId, clientSecret, redirectUri) => {
    const values = {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
    };
    const url = `https://oauth2.googleapis.com/token?${new URLSearchParams(values).toString()}`;
    const resp = await axios.post(url, {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
    });
    return await resp.data;
}

module.exports = { getGoogleAuthUrl, getTokens, signJwt, verifyJwt };