export default class UserEpisode {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.id;
        this.title = obj.title;
        this.code = obj.code;
        this.number = obj.number;
        this.date = obj.date;
        this.views = parseInt(obj.views ?? 0);
    }
}
