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
}
