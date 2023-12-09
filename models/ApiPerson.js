class ApiPerson {

    /**
     * @param {Object} person 
     */
    constructor(person) {
        this.id = person.id;
        this.name = person.name;
        this.birthday = person.birthday;
        this.deathday = person.deathday;
        this.nationality = person.nationality;
        this.description = person.description;
        this.poster = person.poster;
        this.shows = person.shows.map(show => new ApiPersonShow(show));
        this.movies = person.movies.map(movie => new ApiPersonMovie(movie));
    }
}

class ApiPersonShow {

    /**
     * @param {Object} obj 
     */
    constructor(obj) {
        const { show } = obj;
        this.name = obj.name;
        this.id = show.id;
        this.title = show.title;
        this.seasons = show.seasons;
        this.episodes = show.episodes;
        this.creation = show.creation;
        this.poster = show.poster;
    }
}

class ApiPersonMovie {

    /**
     * @param {Object} obj 
     */
    constructor(obj) {
        const { movie } = obj;
        this.name = obj.name;
        this.id = movie.id;
        this.title = movie.title;
        this.productionYear = movie.production_year;
        this.poster = movie.poster;
    }
}

module.exports = ApiPerson;