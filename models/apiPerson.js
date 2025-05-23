export default class ApiPerson {

    /**
     * @param {Object} person
     */
    constructor(person) {
        this.id = parseInt(person.id);
        this.name = person.name;
        this.birthday = person.birthday;
        this.deathday = person.deathday;
        this.nationality = person.nationality;
        this.description = person.description;
        this.poster = person.poster;
        this.series = person.shows.map(show => new ApiPersonShow(show)).sort((a, b) => b.creation - a.creation);
        //this.movies = person.movies.map(movie => new ApiPersonMovie(movie)).sort((a, b) => b.productionYear - a.productionYear);
    }
}

class ApiIntertainment {

    constructor(obj) {
        this.id = parseInt(obj.id);
        this.name = obj.name;
        this.title = obj.title;
        this.creation = parseInt(obj.creation);
        this.poster = obj.poster;
    }
}

class ApiPersonShow extends ApiIntertainment {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        const {show} = obj;
        super(show);
        this.seasons = parseInt(show.seasons);
        this.episodes = parseInt(show.episodes);
    }
}

class ApiPersonMovie extends ApiIntertainment {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        const {movie} = obj;
        super(movie);
    }
}