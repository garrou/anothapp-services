export default class UserEpisode {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.id ?? null;
        this.episodeId = obj["episode_id"];
        this.title = obj.title;
        this.code = obj.code;
        this.number = obj.number;
        this.global = obj.global;
        this.date = obj.date;
        this.watchedAt = obj["watched_at"] ?? null;
    }
}
