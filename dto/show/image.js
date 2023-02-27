class ImageShowDto {

    /**
     * @param {string|null} poster 
     * @param {string|null} show 
     * @param {string|null} banner 
     * @param {string|null} box 
     */
    constructor(poster, show, banner, box) {
        this.poster = poster;
        this.show = show;
        this.banner = banner;
        this.box = box;
    }
}

const getImageUrl = (image) => {
    if (image.poster) {
        return image.poster;
    } 
    if (image.show) {
        return image.show;
    }
    if (image.banner) {
        return image.banner;
    }
    if (image.box) {
        return image.box;
    }
}

module.exports = { ImageShowDto, getImageUrl };