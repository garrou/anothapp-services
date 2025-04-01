export default class Show {
    constructor(obj) {
        this.id = obj.id;
        this.title = obj.title;
        this.poster = obj.poster;
        this.kinds = obj.kinds.split(";");
        this.duration = obj.duration;
        this.seasons = obj.seasons;
        this.country = obj.country;
    }
}