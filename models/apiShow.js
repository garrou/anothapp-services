import ApiEntity from "./apiEntity.js";
import Platform from "./platform.js";

const UNKNOW = "N/A";

class ApiShowPreview extends ApiEntity {

    constructor(show) {
        super(show.id, show.title);
        this.poster = show.poster ?? "";
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
        this.duration = parseInt(show.length ?? "0");
        this.country = show.country ?? UNKNOW;
        this.description = show.description;
        this.seasons = parseInt(show.seasons);
        this.episodes = parseInt(show.episodes);
        this.network = show.network ?? UNKNOW;
        this.note = getNote(show.notes);
        this.status = show.status === "Continuing" ? "En cours" : "Terminée";
        this.creation = parseInt(show.creation);
        this.kinds = Object.values(show.genres);
        this.platforms = getPlatforms(show.platforms?.svods);
    }
}

/**
 * @param {object} platforms
 * @return object[]
 */
const getPlatforms = (platforms) => platforms?.map((p) => Platform.from(p.name, p.logo)) ?? [];

/**
 * @param {Object?} note
 * @returns {number|null}
 */
const getNote = (note) => {
    if (Object.keys(note ?? {}).length === 0) return null;
    return note.mean;

}

/**
 * @param {Object?} image
 * @returns string|null
 */
const getImageUrl = (image) => {
    if (Object.keys(image ?? {}).length === 0) return "";
    if (image.poster) return image.poster;
    if (image.show) return image.show;
    if (image.banner) return image.banner;
    if (image.box) return image.box;
    return "";
}

export {ApiShow, ApiShowPreview};