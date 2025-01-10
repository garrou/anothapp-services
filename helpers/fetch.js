import axios from "axios";
import {DEFAULT_LIMIT, MAX_LIMIT} from "../constants/fetch.js";

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
    static #buildUrl = (url, query, param) => {
        return param === undefined || param === ""
            ? url
            : url.concat(`${url.includes("?") ? "&" : "?"}${query}=${param}`);
    }

    /**
     * @param {string?} limit
     * @returns {number}
     */
    static buildLimit = (limit) => {
        if (!limit || limit === "") {
            return DEFAULT_LIMIT;
        }
        const num = parseInt(limit);

        if (isNaN(num) || num < 0) {
            return DEFAULT_LIMIT;
        }
        return num;
    }

    /**
     * @param {number} limit
     * @returns {number[]}
     */
    static #splitLimit(limit) {
        const chunks = [];
        let remaining = limit;

        while (remaining > 0) {
            const chunk = Math.min(remaining, MAX_LIMIT);
            chunks.push(chunk);
            remaining -= chunk;
        }
        return chunks;
    }

    /**
     * @param {string} url
     * @param {Param[]} params
     * @returns string
     */
    static buildUrlWithParams = (url, params) => {
        return params.reduce((acc, curr) => this.#buildUrl(acc, curr.name, curr.value), url);
    }

    /**
     * @param {string} url
     * @param {Object} headers
     * @param {string} queryPage
     * @param {number} limit
     * @returns {Promise[]}
     */
    static fetchPromises = (url, headers, queryPage, limit) => {
        const promises = [];
        const limits = this.#splitLimit(limit);

        for (let page = 0; page < limits.length; page += 1) {
            const currUrl = this.#buildUrl(this.#buildUrl(url, queryPage, page), "limit", limits[page]);
            promises.push(axios.get(currUrl, { headers }));
        }
        return promises;
    }
}