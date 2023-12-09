class ApiShowDetails {

    /**
     * @param {Object} show 
     */
    constructor(show) {
        this.id = show.id;
        this.title = show.title;
        this.description = show.description;
        this.seasons = show.seasons;
        this.episodes = show.episodes;
        this.duration = show.length;
        this.network = show.network;
        this.note = show.notes.mean;
        this.images = show.images;
        this.status = show.status;
        this.creation = show.creation;
        this.kinds = Object.values(show.genres);
    }
}

module.exports = ApiShowDetails;