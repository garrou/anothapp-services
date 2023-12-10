class ApiSeason {

    /**
     * @param {Object} season 
     */
    constructor(season) {
        this.number = season.number;
        this.episode = season.episodes;
        this.image = season.image;
    }
}

module.exports = ApiSeason;