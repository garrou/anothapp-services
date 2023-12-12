class Season {

    /**
     * @param {Object} obj 
     */
    constructor(obj) {
        this.showId = obj.show_id;
        this.number = obj.number;
        this.episode = obj.episode;
        this.image = obj.image;
    }
}

module.exports = Season;