import axios from "axios";
import {headers} from "../constants/api.js";

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
 * @param {string?} limit
 * @returns number
 */
const buildLimit = (limit) => {
    return !limit || limit === "" || isNaN(parseInt(limit)) ? 20 : parseInt(limit);
}

/**
 * @param {number} limit
 * @returns number
 */
const buildPagination = (limit) => {
    const page = Math.round(limit / 100);
    return page > 0 ? page : 1;
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
    for (let page = 1; page <= buildPagination(limit); page += 1) {
        promises.push(axios.get(buildUrl(url, queryPage, page), { headers }));
    }
    return promises;
}

export {
    buildLimit,
    buildUrlWithParams,
    fetchPromises,
    Param
}