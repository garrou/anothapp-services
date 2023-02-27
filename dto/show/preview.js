const { ImageShowDto } = require("./image");

class PreviewShowDto {

    /**
     * @param {number} id 
     * @param {string} title 
     * @param {ImageShowDto} images 
     * @param {number} duration 
     */
    constructor(id, title, images, duration) {
        this.id = id;
        this.title = title;
        this.images = images;
        this.duration = duration;
    }
}

module.exports = { PreviewShowDto };