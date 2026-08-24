export default class EpisodeTimeline {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.showId = obj.id;
        this.showTitle = obj.title;
        this.showPoster = obj.poster;
        this.watchedAt = obj["watched_at"];
        this.platformId = obj["platform_id"];
        this.episode = {
            id: obj["episode_id"],
            title: obj["episode_title"],
            code: obj["episode_code"],
            number: obj["episode_number"],
            global: obj["episode_global"]
        };
    }
}
