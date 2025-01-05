import SearchService from "../services/searchService.js";

export default class SearchController {
    constructor() {
        this.searchService = new SearchService();
    }

    getImages = async (req, res, next) => {
        try {
            const { limit } = req.query;
            const images = await this.searchService.getImages(limit);
            res.status(200).json(images);
        } catch (e) {
            next(e);
        }
    }

    getShows = async (req, res, next) => {
        try {
            const { title, year, kinds, platforms } = req.query;
            const response = await this.searchService.getShows(title, year, kinds, platforms);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }

    getByShowId = async (req, res, next) => {
        try {
            const { showId } = req.params;
            const show = await this.searchService.getByShowId(showId);
            res.status(200).json(show);
        } catch (e) {
            next(e);
        }
    }

    getSeasonsByShowId = async (req, res, next) => {
        try {
            const { showId } = req.params;
            const seasons = await this.searchService.getSeasonsByShowId(showId);
            res.status(200).json(seasons);
        } catch (e) {
            next(e);
        }
    }

    getEpisodesByShowIdBySeason = async (req, res, next) => {
        try {
            const { showId, num } = req.params;
            const episodes = await this.searchService.getEpisodesByShowIdBySeason(showId, num)
            res.status(200).json(episodes);
        } catch (e) {
            next(e);
        }
    }

    getCharactersByShowId = async (req, res, next) => {
        try {
            const { showId } = req.params;
            const characters = await this.searchService.getCharactersByShowId(showId);
            res.status(200).json(characters);
        } catch (e) {
            next(e);
        }
    }

    getSimilarsByShowId = async (req, res, next) => {
        try {
            const { showId } = req.params;
            const similars = await this.searchService.getSimilarsByShowId(showId);
            res.status(200).json(similars);
        } catch (e) {
            next(e);
        }
    }

    getKinds = async (_, res, next) => {
        try {
            const kinds = await this.searchService.getKinds();
            res.status(200).json(kinds);
        } catch (e) {
            next(e);
        }
    }

    getImagesByShowId = async (req, res, next) => {
        try {
            const { showId } = req.params;
            const pictures = await this.searchService.getImagesByShowId(showId);
            res.status(200).json(pictures);
        } catch (e) {
            next(e);
        }
    }

    getPersonById = async (req, res, next) => {
        try {
            const { personId } = req.params;
            const person = await this.searchService.getPersonById(personId);
            res.status(200).json(person);
        } catch (e) {
            next(e);
        }
    }

    getPlatforms = async (req, res, next) => {
        try {
            const platforms = await this.searchService.getPlatforms();
            res.status(200).json(platforms);
        } catch (e) {
            next(e);
        }
    }
}