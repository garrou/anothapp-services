import Platform from "./Platform.js";

class UserSeason {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.id;
        this.addedAt = obj.added_at;
        this.platform = new Platform(obj);
    }
}

export default UserSeason;