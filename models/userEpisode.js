export default class UserEpisode {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj["user_episode_id"] ?? null;
        this.episodeId = obj.id;
        this.addedAt = obj["added_at"] ?? null;
        this.number = obj.number;
        this.season = obj.season;
        this.title = obj.title;
        this.code = obj.code;
        this.global = obj.global;
        this.length = obj.length;
        this.date = obj.date;
        this.watched = obj["user_episode_id"] != null;
    }
}
