import EpisodeRepository from "../repositories/episodeRepository.js";
import ServiceError from "../helpers/serviceError.js";
import {ERROR_INVALID_REQUEST} from "../constants/errors.js";

export default class EpisodeService {

    constructor() {
        this._episodeRepository = new EpisodeRepository();
    }

    /**
     * @param {string} currentUserId
     * @param {number?} episodeId
     * @returns {Promise<void>}
     */
    deleteByEpisodeId = async (currentUserId, episodeId) => {
        if (!episodeId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const deleted = await this._episodeRepository.deleteEpisodeById(currentUserId, episodeId);

        if (!deleted) {
            throw new ServiceError(500, "Impossible de supprimer l'épisode");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {number?} episodeId
     * @param {number?} platformId
     * @param {string?} viewedAt
     * @returns {Promise<void>}
     */
    updateByEpisodeId = async (currentUserId, episodeId, platformId, viewedAt) => {
        if (!episodeId || !platformId || !viewedAt) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const updated = await this._episodeRepository.updateEpisode(currentUserId, episodeId, platformId, viewedAt);

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier l'épisode");
        }
    }
}
