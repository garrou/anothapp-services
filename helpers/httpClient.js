import axios from "axios";

export default class HttpClient {

    /**
     * @param {string} url
     * @param {Object} headers
     * @param {number} [timeoutMs]
     * @returns {Promise<any>} the parsed response body
     */
    static get = async (url, headers = {}, timeoutMs) => {
        const {data} = await axios.get(url, {headers, timeout: timeoutMs});
        return data;
    }

    /**
     * @param {string} url
     * @param {Object} body
     * @returns {Promise<any>} the parsed response body
     */
    static post = async (url, body) => {
        const {data} = await axios.post(url, body);
        return data;
    }
}
