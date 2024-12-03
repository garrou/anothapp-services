const Season = require("../models/Season");

/**
 * @param {Season[]} arr
 * @returns number[]
 */
const cumulate = (arr) => {
    const result = new Array(arr.length + 1).fill(0);
    arr.forEach((s, i) => result[i+1] = result[i] + s.episodes);
    return result;
}

/**
 * @param {string} url 
 * @param {string} query 
 * @param {any} param 
 * @returns string
 */
const buildUrl = (url, query, param) => {
    return param === undefined ? url : url.concat(`${url.includes("?") ? "&" : "?"}${query}=${param}`);
}

module.exports = {
    buildUrl,
    cumulate
}