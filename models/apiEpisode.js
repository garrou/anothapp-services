import ApiEntity from "./apiEntity.js";

export default class ApiEpisode extends ApiEntity {

    /**
     * @param {Object} episode
     */
    constructor(episode) {
        super(episode.id, episode.title);
        this.number = episode.episode;
        this.season = episode.season;
        this.code = episode.code;
        this.global = episode.global;
        this.length = episode.length;
        this.date = episode.date;
    }
}
