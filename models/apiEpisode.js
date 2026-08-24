import ApiEntity from "./apiEntity.js";

export default class ApiEpisode extends ApiEntity {

    /**
     * @param {Object} episode
     */
    constructor(episode) {
        super(episode.id, episode.title);
        this.code = episode.code;
        this.global = episode.global;
        this.description = episode.description;
        this.date = episode.date;
        this.season = episode.season;
        this.number = episode.episode;
        this.length = episode.length;
    }
}