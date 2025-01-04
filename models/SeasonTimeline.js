import Season from "./Season.js";

class SeasonTimeline {

    /**
     * @param {Object} obj 
     */
    constructor(obj) {
        this.showId = obj.id;
        this.showTitle = obj.title;
        this.addedAt = obj.added_at;
        this.season = Season.from(obj.number, obj.episodes, obj.image ?? obj.poster);
    }
}

export default SeasonTimeline;