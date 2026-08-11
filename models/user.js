export default class User {
    /**
     * @param {Object} user
     */
    constructor(user) {
        this.id = user.id;
        this.email = user.email;
        this.picture = user.picture;
        this.username = user.username;
        this.password = user.password;
        this.lastExport = user["last_export"];
    }

    /**
     * @param {string} field
     * @return boolean
     */
    static isValidField = (field) => {
        return ["email", "password", "picture", "last_export"].includes(field);
    }
}