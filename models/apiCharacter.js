class ApiCharacter {

    /**
     * @param {Object} character
     */
    constructor(character) {
        this.id = character.person_id;
        this.name = character.name;
        this.actor = character.actor;
        this.picture = character.picture;
    }
}

export default ApiCharacter;