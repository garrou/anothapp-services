import axios from 'axios';
import {ApiShow, ApiShowPreview} from '../models/ApiShow.js';
import ApiEpisode from '../models/ApiEpisode.js';
import Season from '../models/Season.js';
import ApiCharacter from '../models/ApiCharacter.js';
import ApiEntity from '../models/ApiEntity.js';
import ApiShowKind from '../models/ApiShowKind.js';
import ApiPerson from '../models/ApiPerson.js';
import {cumulate} from '../helpers/utils.js';
import platformRepository from '../repositories/platformRepository.js';
import Platform from '../models/Platform.js';
import {buildUrlWithParams, fetchPromises, Param, buildLimit} from '../helpers/fetch.js';

const baseUrl = "https://api.betaseries.com";
const headers = {"X-BetaSeries-Key": process.env.BETASERIES_KEY}

export class SearchService {

    /**
     * @param {string?} title
     * @returns {Promise<void>}
     */
    async getShows(title) {
        return title
            ? this.#getShowsByTitle(title)
            : this.#getShowsToDiscover(buildLimit());
    }

    /**
     * @param {number} limit
     * @returns Promise<ApiShow[]>
     */
    async #getShowsToDiscover(limit) {
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
     * @returns Promise<ApiShowPreview[]>
     */
    async #getShowsByTitle(title) {
        const allShows = [];
        const numLimit = buildLimit();
        const url = buildUrlWithParams(`${baseUrl}/search/shows`, [
            new Param("text", title),
        ]);
        const results = await Promise.all(fetchPromises(url, "offset", numLimit));

        for (const result of results) {
            const {shows} = result.data;
            allShows.push(...shows.map((s) => new ApiShowPreview(s)));
        }
        return allShows;
    }

    /**
     * @param {string} limit
     * @returns {Promise<string[]>}
     */
    async getImages(limit) {
        const numLimit = buildLimit(limit);
        const shows = await this.#getShowsToDiscover(numLimit);
        return shows.map((s) => s.poster);
    }

    /**
     * @param {number?} showId
     * @returns {Promise<ApiShow>}
     */
    async getByShowId(showId) {
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
    async getSeasonsByShowId(showId) {
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
    async getEpisodesByShowIdBySeason(showId, num) {
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
    async getCharactersByShowId(showId) {
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
    async getSimilarsByShowId(showId) {

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
     * @returns {Promise<ApiShowKind[]>}
     */
    async getKinds() {
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
    async getImagesByShowId(showId) {

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
    async getPersonById(personId) {
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
    async getPlatforms() {
        const rows = await platformRepository.getPlatforms();
        return rows.map((row) => new Platform(row));
    }
}
