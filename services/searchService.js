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
import {ERROR_INVALID_REQUEST} from "../constants/errors.js";
import NoteRepository from "../repositories/noteRepository.js";
import BetaseriesClient from "../helpers/betaseriesClient.js";

export default class SearchService {

    constructor() {
        this._platformRepository = new PlatformRepository();
        this._noteRepository = new NoteRepository();
        this._client = new BetaseriesClient();
    }

    /**
     * @param {string?} title
     * @param {string?} year
     * @param {string?} kind
     * @param {string?} platform
     * @param {string?} limit
     * @returns {Promise<ApiShow[]|ApiShowPreview[]>}
     */
    getShows = async (title, year, kind, platform, limit) => {
        return title || year || kind || platform
            ? this.#getShowsByFilters(title, year, kind, platform, limit)
            : this.#getShowsToDiscover(FetchHelper.buildLimit(limit));
    }

    /**
     * @param {string} limit
     * @returns {Promise<string[]>}
     */
    getImages = async (limit) => {
        const shows = await this.#getShowsToDiscover(FetchHelper.buildLimit(limit));
        return shows.map((s) => s.poster);
    }

    /**
     * @param {number?} id
     * @returns {Promise<ApiShow>}
     */
    getByShowId = async (id) => {
        if (!id) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const {show} = await this._client.get(`/shows/display?id=${id}`);
        return new ApiShow(show);
    }

    /**
     * @param {number?} id
     * @returns {Promise<Season[]>}
     */
    getSeasonsByShowId = async (id) => {
        if (!id) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const {seasons} = await this._client.get(`/shows/seasons?id=${id}`);
        const episodes = cumulate(seasons, "episodes");
        return seasons.map((s, i) => new Season(s, `${episodes[i] + 1} - ${episodes[i + 1]}`));
    }

    /**
     * @param {number?} id
     * @param {number?} num
     * @returns {Promise<Season|null>}
     */
    getSeasonByShowIdByNumber = async (id, num) => {
        if (!id || !num) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const seasons = await this.getSeasonsByShowId(id);
        const filteredSeasons = seasons.filter((s) => s.number === num);
        return filteredSeasons.length > 0 ? filteredSeasons[0] : null;
    }

    /**
     * @param {number?} id
     * @param {number?} num
     * @returns {Promise<ApiEpisode[]>}
     */
    getEpisodesByShowIdBySeason = async (id, num) => {
        if (!id || !num) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const {episodes} = await this._client.get(`/shows/episodes?id=${id}&season=${num}`);
        return episodes.map(episode => new ApiEpisode(episode));
    }

    /**
     * @param {number?} id
     * @returns {Promise<ApiCharacter[]>}
     */
    getCharactersByShowId = async (id) => {
        if (!id) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const {characters} = await this._client.get(`/shows/characters?id=${id}`);
        return characters.map(character => new ApiCharacter(character));
    }

    /**
     * @param {number?} id
     * @returns {Promise<ApiEntity[]>}
     */
    getSimilarsByShowId = async (id) => {
        if (!id) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const {similars} = await this._client.get(`/shows/similars?id=${id}`);
        return similars.map((s) => new ApiEntity(s["show_id"], s["show_title"]));
    }

    /**
     * @returns {Promise<ApiShow[]>}
     */
    getKinds = async () => {
        const {genres} = await this._client.get(`/shows/genres`);
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
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const {pictures} = await this._client.get(`/shows/pictures?id=${id}`);
        return pictures.map(p => p.url);
    }

    /**
     * @param {number?} id
     * @returns {Promise<ApiPerson>}
     */
    getPersonById = async (id) => {
        if (!id) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const {person} = await this._client.get(`/persons/person?id=${id}`);
        return new ApiPerson(person);
    }

    /**
     * @returns {Promise<Platform[]>}
     */
    getPlatforms = async () => {
        return this._platformRepository.getPlatforms();
    }

    /**
     * @returns {Promise<Note[]>}
     */
    getNotes = async () => {
        return this._noteRepository.getNotes();
    }

    /**
     * @param {number} limit
     * @returns {Promise<ApiShow[]>}
     */
    #getShowsToDiscover = async (limit) => {
        const allShows = [];
        const promises = FetchHelper.fetchPromises(`${this._client.baseUrl}/shows/discover`, this._client.headers,"offset", limit);
        const results = await Promise.all(promises);

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
     * @param {string?} limit
     * @returns {Promise<ApiShowPreview[]>}
     */
    #getShowsByFilters = async (title, years, kinds, platforms, limit) => {
        const allShows = [];
        const numLimit = FetchHelper.buildLimit(limit);
        const url = FetchHelper.buildUrlWithParams(`${this._client.baseUrl}/search/shows`, [
            new Param("text", title),
            new Param("genres", kinds),
            new Param("svods", platforms),
            new Param("creations", years),
        ]);
        const promises = FetchHelper.fetchPromises(url, this._client.headers,"offset", numLimit);
        const results = await Promise.all(promises);

        for (const result of results) {
            const {shows} = result.data;
            allShows.push(...shows.map((s) => new ApiShowPreview(s)));
        }
        return allShows;
    }
}
