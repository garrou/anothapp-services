export default class UserProfile {

    /**
     * @param {Object} user
     * @param {boolean} current
     */
    constructor(user, current = false) {
        this.id = user.id;
        this.picture = user.picture;
        this.username = user.username;
        this.current = current;
        this.createdAt = user.createdAt;

        if (current) {
            this.email = user.email;
            this.emailVerified = user.emailVerified;
            this.pendingEmail = user.pendingEmail;
            this.isAdmin = user.id === process.env.ADMIN_ID;
        }
    }
}