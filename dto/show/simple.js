class SimpleShowDto {

    /**
     * @param {number} id 
     * @param {string} title 
     * @param {string|null} poster 
     */
    constructor(id, title, poster) {
        this.id = id;
        this.title = title;
        this.images = {
            poster: poster,
            show: null,
            banner: null,
            box: null
        }
    }
}

module.exports = { SimpleShowDto };