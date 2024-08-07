class ApiShow {

    /**
     * @param {Object} show 
     */
    constructor(show) {
        this.id = show.id;
        this.title = show.title;
        this.poster = getImageUrl(show.images);
        this.duration = show.length ?? 0;
        this.country = show.country;
        this.description = show.description;
        this.seasons = show.seasons;
        this.episodes = show.episodes;
        this.network = show.network;
        this.note = show.notes.mean;
        this.status = show.status === "Continuing" ? "En cours" : "Terminée";
        this.creation = show.creation;
        this.kinds = Object.values(show.genres);
        this.platforms = getPlatforms(show.platforms);
    }
}

/**
 * @param {object} platforms 
 * @return object[]
 */
const getPlatforms = (platforms) => {
    return platforms?.svods
        ? platforms.svods.map((p) => (
            { 
                "name": p.name,
                "logo": p.logo
            }
        ))
        : [];
}

/**
 * @param {Object} image 
 * @returns string
 */
const getImageUrl = (image) => {
    if (image.poster) return image.poster;
    if (image.show) return image.show;
    if (image.banner) return image.banner;
    if (image.box) return image.box;
    return null;
}

module.exports = ApiShow;