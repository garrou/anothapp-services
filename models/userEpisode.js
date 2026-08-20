import Platform from "./platform.js";

class PartialUserEpisode {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.id;
        this.addedAt = obj["added_at"];
        this.platform = new Platform(obj);
    }
}

class UserEpisode {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.episodeId = obj.id;
        this.addedAt = obj["added_at"] ?? null;
        this.number = obj.number;
        this.season = obj.season;
        this.title = obj.title;
        this.code = obj.code;
        this.global = obj.global;
        this.length = obj.length;
        this.date = obj.date;
        this.watched = obj["added_at"] != null;
    }
}

export {
    UserEpisode,
    PartialUserEpisode,
}
