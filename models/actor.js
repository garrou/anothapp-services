export default class Actor {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.id = obj.id;
        this.name = obj.name;
        this.picture = obj.picture;
        this.birthday = obj.birthday;
        this.deathday = obj.deathday;
        this.nationality = obj.nationality;
        this.description = obj.description;
    }
}
