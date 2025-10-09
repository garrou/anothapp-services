export default class ApiCharacter {

    /**
     * @param {Object} character
     */
    constructor(character) {
        this.id = parseInt(character["person_id"]);
        this.name = character.name;
        this.actor = character.actor;
        this.picture = character.picture;
    }
}