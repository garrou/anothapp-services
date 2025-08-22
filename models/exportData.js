class ExportData {

    /**
     * @param {UserProfile} user
     * @param {Object} stats
     */
    constructor(user, stats) {
        this.user = user;
        this.stats = stats;
        this.shows = [];
    }
}

class ExportShow {

    /**
     * @param {UserShow} userShow
     */
    constructor(userShow) {
        const { id, title, kinds, country, seasons, favorite, watch, duration, note, addedAt } = userShow;
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
        this.seasons = [];
    }
}

export {
    ExportData,
    ExportShow
}