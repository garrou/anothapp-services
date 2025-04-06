export default class Season {

    /**
     * @param {Object} obj
     * @param {string?} interval
     */
    constructor(obj, interval = "") {
        this.number = obj.number;
        this.episodes = obj.episodes;
        this.image = obj.image;
        this.interval = interval;
    }

    /**
     * @param {number} number
     * @param {number} episodes
     * @param {string} image
     * @return Season
     */
    static from = (number, episodes, image) => new this({
        number,
        episodes,
        image,
    });
}