const { getImageUrl } = require("../helpers/image");

class ApiShowPreview {

    /**
     * @param {Object} show 
     */
    constructor(show) {
        this.id = show.id;
        this.title = show.title;
        this.image = getImageUrl(show.images);
    }
}

module.exports = ApiShowPreview;