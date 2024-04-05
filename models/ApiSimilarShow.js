class ApiSimilarShow {

    /**
     * @param {Object} show 
     */
    constructor(show) {
        this.id = show.show_id;
        this.title = show.show_title
    }
}

module.exports = ApiSimilarShow;