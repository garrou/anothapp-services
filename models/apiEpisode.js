import ApiEntity from "./apiEntity.js";

class ApiEpisode extends ApiEntity {

    /**
     * @param {Object} episode
     */
    constructor(episode) {
        super(episode.id, episode.title);
        this.code = episode.code;
        this.global = episode.global;
        this.description = episode.description;
        this.date = episode.date;
    }
}

export default ApiEpisode;