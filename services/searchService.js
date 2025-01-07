import axios from 'axios';
import {ApiShow, ApiShowPreview} from '../models/apiShow.js';
import ApiEpisode from '../models/apiEpisode.js';
import Season from '../models/season.js';
import ApiCharacter from '../models/apiCharacter.js';
import ApiEntity from '../models/apiEntity.js';
import ApiPerson from '../models/apiPerson.js';
import {cumulate} from '../helpers/utils.js';
import {Param, FetchHelper} from '../helpers/fetch.js';
import PlatformRepository from "../repositories/platformRepository.js";
import ApiShowKind from "../models/apiShowKind.js";
import ServiceError from "../helpers/serviceError.js";

export default class SearchService {

    constructor() {
        this._platformRepository = new PlatformRepository();
        this._baseUrl = "https://api.betaseries.com";
        this._headers = {"X-BetaSeries-Key": process.env.BETASERIES_KEY};
    }

    /**
     * @param {string?} title
     * @param {string?} year
     * @param {string?} kind
     * @param {string?} platform
     * @returns {Promise<void>}
     */
    getShows = async (title, year, kind, platform) => {
        return title || year || kind || platform
            ? this._getShowsByFilters(title, year, kind, platform)
            : this._getShowsToDiscover(FetchHelper.buildLimit());
    }

    /**
     * @param {string} limit
     * @returns {Promise<string[]>}
     */
    getImages = async (limit) => {
        const numLimit = FetchHelper.buildLimit(limit);
        const shows = await this._getShowsToDiscover(numLimit);
        return shows.map((s) => s.poster);
    }

    /**
     * @param {number?} id
     * @returns {Promise<ApiShow>}
     */
    getByShowId = async (id) => {
        if (!id) {
            throw new ServiceError(400, "Requête invalide");
        }
        const resp = await axios.get(`${this._baseUrl}/shows/display?id=${id}`, {
            headers: this._headers
        });
        const {show} = await resp.data;
        return new ApiShow(show);
    }

    /**
     * @param {number?} id
     * @returns {Promise<Season[]>}
     */
    getSeasonsByShowId = async (id) => {
        if (!id) {
            throw new ServiceError(400, "Requête invalide");
        }
        const resp = await axios.get(`${this._baseUrl}/shows/seasons?id=${id}`, {
            headers: this._headers
        });
        const {seasons} = await resp.data;
        const episodes = cumulate(seasons, "episodes");
        return seasons.map((s, i) => new Season(s, `${episodes[i] + 1} - ${episodes[i + 1]}`));
    }

    /**
     * @param {number?} id
     * @param {number?} num
     * @returns {Promise<ApiEpisode[]>}
     */
    getEpisodesByShowIdBySeason = async (id, num) => {
        if (!id || !num) {
            throw new ServiceError(400, "Requête invalide");
        }
        const resp = await axios.get(`${this._baseUrl}/shows/episodes?id=${id}&season=${num}`, {
            headers: this._headers
        });
        const {episodes} = await resp.data;
        return episodes.map(episode => new ApiEpisode(episode));
    }

    /**
     * @param {number?} id
     * @returns {Promise<ApiCharacter[]>}
     */
    getCharactersByShowId = async (id) => {
        if (!id) {
            throw new ServiceError(400, "Requête invalide");
        }
        const resp = await axios.get(`${this._baseUrl}/shows/characters?id=${id}`, {
            headers: this._headers
        });
        const {characters} = await resp.data;
        return characters.map(character => new ApiCharacter(character));
    }

    /**
     * @param {number?} id
     * @returns {Promise<ApiEntity[]>}
     */
    getSimilarsByShowId = async (id) => {
        if (!id) {
            throw new ServiceError(400, "Requête invalide");
        }
        const resp = await axios.get(`${this._baseUrl}/shows/similars?id=${id}`, {
            headers: this._headers
        });
        const {similars} = await resp.data;
        return similars.map((s) => new ApiEntity(s["show_id"], s["show_title"]));
    }

    /**
     * @returns {Promise<ApiShow[]>}
     */
    getKinds = async () => {
        const resp = await axios.get(`${this._baseUrl}/shows/genres`, {
            headers: this._headers
        });
        const {genres} = await resp.data;
        return Object.entries(genres)
            .map(entry => new ApiShowKind(entry))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * @param {number?} id
     * @returns {Promise<string[]>}
     */
    getImagesByShowId = async (id) => {
        if (!id) {
            throw new ServiceError(400, "Requête invalide");
        }
        const resp = await axios.get(`${this._baseUrl}/shows/pictures?id=${id}`, {
            headers: this._headers
        });
        const {pictures} = await resp.data;
        return pictures.map(p => p.url);
    }

    /**
     * @param {number?} id
     * @returns {Promise<ApiPerson>}
     */
    getPersonById = async (id) => {
        if (!id) {
            throw new ServiceError(400, "Requête invalide");
        }
        const resp = await axios.get(`${this._baseUrl}/persons/person?id=${id}`, {
            headers: this._headers
        });
        const {person} = await resp.data;
        return new ApiPerson(person);
    }

    /**
     * @returns {Promise<Platform[]>}
     */
    getPlatforms = async () => {
        return await this._platformRepository.getPlatforms();
    }

    /**
     * @param {number} limit
     * @returns {Promise<ApiShow[]>}
     */
    _getShowsToDiscover = async (limit) => {
        const allShows = [];
        const url = FetchHelper.buildUrlWithParams(`${this._baseUrl}/shows/discover`, [
            new Param("limit", limit)
        ]);
        const results = await Promise.all(FetchHelper.fetchPromises(url, this._headers,"offset", limit));

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
     * @returns {Promise<ApiShowPreview[]>}
     */
    _getShowsByFilters = async (title, years, kinds, platforms) => {
        const allShows = [];
        const numLimit = FetchHelper.buildLimit();
        const url = FetchHelper.buildUrlWithParams(`${this._baseUrl}/search/shows`, [
            new Param("text", title),
            new Param("genres", kinds),
            new Param("svods", platforms),
            new Param("creations", years),
            new Param("limit", numLimit),
        ]);
        const results = await Promise.all(FetchHelper.fetchPromises(url, this._headers,"offset", numLimit));

        for (const result of results) {
            const {shows} = result.data;
            allShows.push(...shows.map((s) => new ApiShowPreview(s)));
        }
        return allShows;
    }
}
