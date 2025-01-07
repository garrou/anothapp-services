import axios from "axios";

export class Param {
    constructor(name, value) {
        this.name = name;
        this.value = value;
    }
}

export class FetchHelper {

    /**
     * @param {string} url
     * @param {string} query
     * @param {any} param
     * @returns {string}
     */
    static buildUrl = (url, query, param) => {
        return param === undefined || param === ""
            ? url
            : url.concat(`${url.includes("?") ? "&" : "?"}${query}=${param}`);
    }

    /**
     * @param {string?} limit
     * @returns {number}
     */
    static buildLimit = (limit) => {
        return !limit || limit === "" || isNaN(parseInt(limit)) ? 20 : parseInt(limit);
    }

    /**
     * @param {number} limit
     * @returns {number}
     */
    static buildPagination = (limit) => {
        const page = Math.round(limit / 100);
        return page > 0 ? page : 1;
    }

    /**
     * @param {string} url
     * @param {Param[]} params
     * @returns string
     */
    static buildUrlWithParams = (url, params) => {
        return params.reduce((acc, curr) => this.buildUrl(acc, curr.name, curr.value), url);
    }

    /**
     * @param {string} url
     * @param {Object} headers
     * @param {string} queryPage
     * @param {number} limit
     * @returns Promise[]
     */
    static fetchPromises = (url, headers, queryPage, limit) => {
        const promises = [];
        for (let page = 1; page <= this.buildPagination(limit); page += 1) {
            promises.push(axios.get(this.buildUrl(url, queryPage, page), { headers }));
        }
        return promises;
    }
}