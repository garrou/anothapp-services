class UserProfile {

    /**
     * @param {Object} user
     * @param {boolean} current
     */
    constructor(user, current = false) {
        this.id = user.id;
        this.email = user.email;
        this.picture = user.picture;
        this.username = user.username;
        this.current = current;
    }
}

export default UserProfile;