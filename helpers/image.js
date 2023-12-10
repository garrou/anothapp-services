/**
 * @param {Object} image 
 * @returns string | null 
 */
const getImageUrl = (image) => {
    if (image.poster) return image.poster;
    if (image.show) return image.show;
    if (image.banner) return image.banner;
    if (image.box) return image.box;
    return null;
}

module.exports = { getImageUrl };