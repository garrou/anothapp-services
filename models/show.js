export default class Show {
    constructor(obj) {
        this.id = obj.id;
        this.title = obj.title;
        this.poster = obj.poster;
        this.kinds = obj.kind_names ?? [];
        this.duration = obj.duration;
        this.seasons = obj.seasons;
        this.country = obj.country;
        this.description = obj.description;
        this.creation = obj.creation;
        this.network = obj.network;
        this.language = obj.language;
        this.episodes = obj.episodes;
    }
}