export default class UserExport {

    /**
     * @param {Object} user
     */
    constructor(user) {
        this.picture = user.picture;
        this.username = user.username;
        this.createdAt = user.createdAt;
        this.email = user.email;
        this.emailVerified = user.emailVerified;
        this.pendingEmail = user.pendingEmail;
    }
}