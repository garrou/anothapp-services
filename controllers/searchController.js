import { SearchService } from "../services/searchService.js";

export class SearchController {
    constructor() {
        this.searchService = new SearchService();
    }

    async getImages(req, res, next) {
        try {
            const { limit } = req.query;
            const images = await this.searchService.getImages(limit);
            res.status(200).json(images);
        } catch (e) {
            next(e);
        }
    }

    async getShows(req, res, next) {
        try {
            const { title } = req.query;
            const response = await this.searchService.getShows(title);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }

    async getByShowId(req, res, next) {
        try {
            const { showId } = req.params;
            const show = await this.searchService.getByShowId(showId);
            res.status(200).json(show);
        } catch (e) {
            next(e);
        }
    }

    async getSeasonsByShowId(req, res, next) {
        try {
            const { showId } = req.params;
            const seasons = await this.searchService.getSeasonsByShowId(showId);
            res.status(200).json(seasons);
        } catch (e) {
            next(e);
        }
    }

    async getEpisodesByShowIdBySeason(req, res, next) {
        try {
            const { showId, num } = req.params;
            const episodes = await this.searchService.getEpisodesByShowIdBySeason(showId, num)
            res.status(200).json(episodes);
        } catch (e) {
            next(e);
        }
    }

    async getCharactersByShowId(req, res, next) {
        try {
            const { showId } = req.params;
            const characters = await this.searchService.getCharactersByShowId(showId);
            res.status(200).json(characters);
        } catch (e) {
            next(e);
        }
    }

    async getSimilarsByShowId(req, res, next) {
        try {
            const { showId } = req.params;
            const similars = await this.searchService.getSimilarsByShowId(showId);
            res.status(200).json(similars);
        } catch (e) {
            next(e);
        }
    }

    async getKinds(_, res, next) {
        try {
            const kinds = await this.searchService.getKinds();
            res.status(200).json(kinds);
        } catch (e) {
            next(e);
        }
    }

    async getImagesByShowId(req, res, next) {
        try {
            const { showId } = req.params;
            const pictures = await this.searchService.getImagesByShowId(showId);
            res.status(200).json(pictures);
        } catch (e) {
            next(e);
        }
    }

    async getPersonById(req, res, next) {
        try {
            const { personId } = req.params;
            const person = await this.searchService.getPersonById(personId);
            res.status(200).json(person);
        } catch (e) {
            next(e);
        }
    }

    async getPlatforms(req, res) {
        try {
            const rows = await platformRepository.getPlatforms();
            res.status(200).json(rows.map((row) => new Platform(row)));
        } catch (e) {
            res.status(500).json({ "message": "Une erreur est survenue " });
        }
    }
}