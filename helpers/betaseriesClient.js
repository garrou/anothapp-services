import HttpClient from "./httpClient.js";

const BASE_URL = "https://api.betaseries.com";

export default class BetaseriesClient {

    /**
     * @param {string} apiKey
     */
    constructor(apiKey = process.env.BETASERIES_KEY) {
        this.baseUrl = BASE_URL;
        this.headers = {"X-BetaSeries-Key": apiKey};
    }

    /**
     * @param {string} path starting with "/", including any query string
     * @param {number} [timeoutMs]
     * @returns {Promise<any>} the parsed response body
     */
    get = async (path, timeoutMs) => {
        return HttpClient.get(`${this.baseUrl}${path}`, this.headers, timeoutMs);
    }
}
