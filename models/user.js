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
    }
}