class UserProfile {

    /**
     * @param {Object} user 
     */
    constructor(user) {
        this.id = user.id;
        this.email = user.email;
        this.picture = user.picture
    }
}

module.exports = UserProfile;