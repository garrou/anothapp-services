import Platform from "./platform.js";

class PartialUserSeason {

    /**
     * @param {Object} obj
     * @param {import("./userProfile.js").default[]} [watchedWith]
     */
    constructor(obj, watchedWith = []) {
        this.id = obj.id;
        this.addedAt = obj["added_at"];
        this.platform = new Platform(obj);
        this.watchedWith = watchedWith;
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
        this.platformId = obj["platform_id"];
        this.showId = obj["show_id"];
    }
}

export {
    UserSeason,
    PartialUserSeason,
}