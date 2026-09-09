export default class Playlist {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.id;
        this.userId = obj["user_id"];
        this.name = obj.name;
        this.createdAt = obj["created_at"];
        this.visible = obj.visible;
        this.showsCount = obj["shows_count"] !== undefined ? parseInt(obj["shows_count"]) : undefined;
    }
}
