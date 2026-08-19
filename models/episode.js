export default class Episode {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.id;
        this.title = obj.title;
        this.number = obj.number;
        this.season = obj.season;
        this.code = obj.code;
        this.global = obj.global;
        this.length = obj.length;
        this.date = obj.date;
        this.showId = obj["show_id"];
    }
}
