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

module.exports = { getImageUrl };