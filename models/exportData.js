import UserExport from "./userExport.js";

class ExportData {

    /**
     * @param {User} user
     * @param {Object} stats
     */
    constructor(user, stats) {
        this.user = new UserExport(user);
        this.stats = stats;
        this.shows = [];
        this.friends = [];
        this.playlists = [];
        this.favoriteActors = [];
        this.platforms = [];
        this.achievements = [];
    }
}

class ExportShow {

    /**
     * @param {UserShow} userShow
     */
    constructor(userShow) {
        const {
            id, title, kinds, country, seasons, favorite, watch, duration, note, addedAt,
            poster, description, creation, network, language, episodes, finished,
        } = userShow;
        this.id = id;
        this.title = title;
        this.kinds = kinds;
        this.country = country;
        this.seasonsNumber = seasons;
        this.episodeDuration = duration;
        this.isFavorite = favorite;
        this.isWatching = watch;
        this.note = note;
        this.addedAt = addedAt;
        this.poster = poster;
        this.description = description;
        this.creation = creation;
        this.network = network;
        this.language = language;
        this.totalEpisodes = episodes;
        this.finished = finished;
        this.seasons = [];
    }
}

export {
    ExportData,
    ExportShow
}