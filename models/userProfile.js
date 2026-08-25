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
        this.episodeTrackingEnabled = user.episodeTrackingEnabled;

        if (current) {
            this.email = user.email;
        }
    }
}