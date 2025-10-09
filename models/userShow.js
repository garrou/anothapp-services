export default class UserShow {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.id;
        this.title = obj.title;
        this.poster = obj.poster;
        this.kinds = obj.kinds.split(";");
        this.favorite = obj.favorite;
        this.missing = obj.missing;
        this.duration = obj.duration;
        this.addedAt = obj["added_at"];
        this.country = obj.country;
        this.watch = obj.continue;
        this.seasons = obj.seasons;
        this.note = obj["note_id"];
        this.finished = obj.finished;
        this.nextEpisode = obj["next_episode"];
    }
}