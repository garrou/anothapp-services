const axios = require("axios");
const key = process.env.BETASERIES_KEY;

class Param {
    constructor(name, value) {
        this.name = name;
        this.value = value;
    }
}

/**
 * @param {string} url 
 * @param {string} query 
 * @param {any} param 
 * @returns string
 */
const buildUrl = (url, query, param) => {
    return param === undefined || param === "" 
        ? url 
        : url.concat(`${url.includes("?") ? "&" : "?"}${query}=${param}`);
}

/**
 * @param {any?} limit 
 * @returns number
 */
const buildLimit = (limit) => {
    return limit === undefined || isNaN(limit) || limit === "" ? 20 : limit;
}

/**
 * @param {string} url
 * @param {Param[]} params 
 * @returns string
 */
const buildUrlWithParams = (url, params) => {
    return params.reduce((acc, curr) => buildUrl(acc, curr.name, curr.value), url);
}

/**
 * @param {string} url 
 * @param {string} queryPage
 * @param {number} limit 
 * @returns Promise[]
 */
const fetchPromises = (url, queryPage, limit) => {
    const promises = [];

    for (let page = 0; page <= Math.round(limit / 100); page += 1) {
        promises.push(axios.get(buildUrl(url, queryPage, page), { headers: { "X-BetaSeries-Key": key } }));
    }
    return promises;
}

module.exports = {
    buildLimit,
    buildUrlWithParams,
    fetchPromises,
    Param
}