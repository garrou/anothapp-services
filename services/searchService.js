import axios from 'axios';
import {ApiShow, ApiShowPreview} from '../models/apiShow.js';
import ApiEpisode from '../models/apiEpisode.js';
import Season from '../models/season.js';
import ApiCharacter from '../models/apiCharacter.js';
import ApiEntity from '../models/apiEntity.js';
import ApiPerson from '../models/apiPerson.js';
import {cumulate} from '../helpers/utils.js';
import Platform from '../models/platform.js';
import {buildUrlWithParams, fetchPromises, Param, buildLimit} from '../helpers/fetch.js';
import PlatformRepository from "../repositories/platformRepository.js";
import ApiShowKind from "../models/apiShowKind.js";

const baseUrl = "https://api.betaseries.com";
const headers = {"X-BetaSeries-Key": process.env.BETASERIES_KEY}

export default class SearchService {

    constructor() {
        this.platformRepository = new PlatformRepository();
    }

    /**
     * @param {string?} title
     * @param {string?} year
     * @param {string?} kind
     * @param {string?} platform
     * @returns {Promise<void>}
     */
    async getShows(title, year, kind, platform) {
        return title || year || kind || platform
            ? this.#getShowsByFilters(title, year, kind, platform)
            : this.#getShowsToDiscover(buildLimit());
    }

    /**
     * @param {string} limit
     * @returns {Promise<string[]>}
     */
    getImages = async (limit) => {
        const numLimit = buildLimit(limit);
        const shows = await this.#getShowsToDiscover(numLimit);
        return shows.map((s) => s.poster);
    }

    /**
     * @param {number?} showId
     * @returns {Promise<ApiShow>}
     */
    getByShowId = async (showId) => {
        if (!showId) {
            throw new Error("Requête invalide");
        }
        const resp = await axios.get(`${baseUrl}/shows/display?id=${showId}`, {
            headers
        });
        const {show} = await resp.data;
        return new ApiShow(show);
    }

    /**
     * @param {number?} showId
     * @returns {Promise<Season[]>}
     */
    getSeasonsByShowId = async (showId) => {
        if (!showId) {
            throw new Error("Requête invalide");
        }
        const resp = await axios.get(`${baseUrl}/shows/seasons?id=${showId}`, {
            headers
        });
        const {seasons} = await resp.data;
        const episodes = cumulate(seasons);
        return seasons.map((s, i) => new Season(s, `${episodes[i] + 1} - ${episodes[i + 1]}`));
    }

    /**
     * @param {number?} showId
     * @param {number?} num
     * @returns {Promise<ApiEpisode[]>}
     */
    getEpisodesByShowIdBySeason = async (showId, num) => {
        if (!showId || !num) {
            throw new Error("Requête invalide");
        }
        const resp = await axios.get(`${baseUrl}/shows/episodes?id=${showId}&season=${num}`, {
            headers
        });
        const {episodes} = await resp.data;
        return episodes.map(episode => new ApiEpisode(episode));
    }

    /**
     * @param {number?} showId
     * @returns {Promise<ApiCharacter[]>}
     */
    getCharactersByShowId = async (showId) => {
        if (!showId) {
            throw new Error("Requête invalide");
        }
        const resp = await axios.get(`${baseUrl}/shows/characters?id=${showId}`, {
            headers
        });
        const {characters} = await resp.data;
        return characters.map(character => new ApiCharacter(character));
    }

    /**
     * @param {number?} showId
     * @returns {Promise<ApiEntity[]>}
     */
    getSimilarsByShowId = async (showId) => {

        if (!showId) {
            throw new Error("Requête invalide");
        }
        const resp = await axios.get(`${baseUrl}/shows/similars?id=${showId}`, {
            headers
        });
        const {similars} = await resp.data;
        return similars.map((s) => new ApiEntity(s["show_id"], s["show_title"]));
    }

    /**
     * @returns {Promise<ApiShow[]>}
     */
    getKinds = async () => {
        const resp = await axios.get(`${baseUrl}/shows/genres`, {
            headers
        });
        const {genres} = await resp.data;
        return Object.entries(genres)
            .map(entry => new ApiShowKind(entry))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * @param {number?} showId
     * @returns {Promise<string[]>}
     */
    getImagesByShowId = async (showId) => {

        if (!showId) {
            throw new Error("Requête invalide");
        }
        const resp = await axios.get(`${baseUrl}/shows/pictures?id=${showId}`, {
            headers
        });
        const {pictures} = await resp.data;
        return pictures.map(p => p.url);
    }

    /**
     * @param {number?} personId
     * @returns {Promise<ApiPerson>}
     */
    getPersonById = async (personId) => {
        if (!personId) {
            throw new Error("Requête invalide");
        }
        const resp = await axios.get(`${baseUrl}/persons/person?id=${personId}`, {
            headers
        });
        const {person} = await resp.data;
        return new ApiPerson(person);
    }

    /**
     * @returns {Promise<Platform[]>}
     */
    getPlatforms = async () => {
        const rows = await this.platformRepository.getPlatforms();
        return rows.map((row) => new Platform(row));
    }

    /**
     * @param {number} limit
     * @returns Promise<ApiShow[]>
     */
    #getShowsToDiscover = async (limit) => {
        const allShows = [];
        const url = buildUrlWithParams(`${baseUrl}/shows/discover`, [
            new Param("limit", limit)
        ]);
        const results = await Promise.all(fetchPromises(url, "offset", limit));

        for (const result of results) {
            const {shows} = result.data;
            allShows.push(...shows.map(show => new ApiShow(show)));
        }
        return allShows;
    }

    /**
     * @param {string?} title
     * @param {string?} years
     * @param {string?} kinds
     * @param {string?} platforms
     * @returns Promise<ApiShowPreview[]>
     */
    #getShowsByFilters = async (title, years, kinds, platforms) => {
        const allShows = [];
        const numLimit = buildLimit();
        const url = buildUrlWithParams(`${baseUrl}/search/shows`, [
            new Param("text", title),
            new Param("genres", kinds),
            new Param("svods", platforms),
            new Param("creations", years),
        ]);
        const results = await Promise.all(fetchPromises(url, "offset", numLimit));

        for (const result of results) {
            const {shows} = result.data;
            allShows.push(...shows.map((s) => new ApiShowPreview(s)));
        }
        return allShows;
    }
}
