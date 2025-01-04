import ApiEntity from "./ApiEntity.js";

class ApiShowPreview extends ApiEntity {

    constructor(show) {
        super(show.id, show.title);
        this.poster = show.poster;
        this.creation = show.release_date;
        this.platforms = getPlatforms(show.svods);
    }
}

class ApiShow extends ApiEntity {

    /**
     * @param {Object} show 
     */
    constructor(show) {
        super(show.id, show.title);
        this.poster = getImageUrl(show.images);
        this.duration = show.length ?? 0;
        this.country = show.country;
        this.description = show.description;
        this.seasons = show.seasons;
        this.episodes = show.episodes;
        this.network = show.network;
        this.note = getNote(show.notes);
        this.status = show.status === "Continuing" ? "En cours" : "Terminée";
        this.creation = show.creation;
        this.kinds = Object.values(show.genres);
        this.platforms = getPlatforms(show.platforms?.svods);
    }
}

/**
 * @param {object} platforms 
 * @return object[]
 */
const getPlatforms = (platforms) => platforms ? platforms.map((p) => (
    {
        "name": p.name,
        "logo": p.logo
    }
)) : [];

/**
 * @param {Object?} note 
 * @returns number
 */
const getNote = (note) => {
    if (Object.keys(note ?? {}).length === 0) return null;
    return note.mean;

}

/**
 * @param {Object?} image 
 * @returns string
 */
const getImageUrl = (image) => {
    if (Object.keys(image ?? {}).length === 0) return null;
    if (image.poster) return image.poster;
    if (image.show) return image.show;
    if (image.banner) return image.banner;
    if (image.box) return image.box;
    return null;
}

export { ApiShow, ApiShowPreview };