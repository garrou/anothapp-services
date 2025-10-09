import Platform from "./platform.js";

class PartialUserSeason {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.id;
        this.addedAt = obj["added_at"];
        this.platform = new Platform(obj);
    }
}

class UserSeason {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.id;
        this.number = obj.number;
        this.addedAt = obj["added_at"];
        this.platform = obj.platform;
        this.showId = obj["show_id"];
    }
}

export {
    UserSeason,
    PartialUserSeason,
}