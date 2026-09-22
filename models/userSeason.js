import Platform from "./platform.js";
import UserProfile from "./userProfile.js";

class PartialUserSeason {

    /**
     * @param {Object} obj
     * @param {import("./userProfile.js").default[]} [watchedWith]
     * @param {{id: string, username: string, picture: string}?} [sharedBy] the owner sharing this
     *   season with the current user, when this viewing is the friend/leaf side of an active
     *   watch-together relation - read-only, never sourced from users_seasons_friends
     */
    constructor(obj, watchedWith = [], sharedBy = null) {
        this.id = obj.id;
        this.addedAt = obj["added_at"];
        this.platform = new Platform(obj);
        this.watchedWith = watchedWith;
        this.sharedBy = sharedBy ? new UserProfile(sharedBy) : null;
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
        this.image = obj.image;
        this.episodesCount = obj.episodes;
    }
}

export {
    UserSeason,
    PartialUserSeason,
}