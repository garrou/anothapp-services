export default class Recommendation {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.id;
        this.title = obj.title;
        this.poster = obj.poster;
        this.kinds = obj.kinds.split(";");
        this.duration = obj.duration;
        this.seasons = obj.seasons;
        this.country = obj.country;
        this.nbFriends = parseInt(obj["nb_friends"]);
        this.avgNote = parseFloat(obj["avg_note"]);
        this.friends = obj.friends;
    }
}
