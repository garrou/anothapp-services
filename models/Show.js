class Show {

    /**
     * @param {Object} obj 
     */
    constructor(obj) {
        this.id = obj.id;
        this.title = obj.title;
        this.poster = obj.poster;
        this.kinds = obj.kinds.split(";");
        this.favorite = obj.favorite;
    }
}

module.exports = Show;