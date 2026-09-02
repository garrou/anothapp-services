export default class Episode {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.id;
        this.showId = obj["show_id"];
        this.seasonNumber = obj["season_number"];
        this.number = obj.number;
        this.title = obj.title;
        this.code = obj.code;
        this.global = obj.global;
        this.length = obj.length;
        this.date = obj.date;
        this.description = obj.description;
    }
}
