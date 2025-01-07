import Platform from "./platform.js";

export default class UserSeason {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.id;
        this.addedAt = obj.added_at;
        this.platform = new Platform(obj);
    }
}