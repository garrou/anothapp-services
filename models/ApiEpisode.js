class ApiEpisode {

    /**
     * @param {Object} episode 
     */
    constructor(episode) {
        this.id = episode.id;
        this.title = episode.title
        this.code = episode.code;
        this.global = episode.global;
        this.description = episode.description;
        this.date = episode.date;
    }
}

module.exports = ApiEpisode;