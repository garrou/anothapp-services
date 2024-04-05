class UserProfile {

    /**
     * @param {Object} user 
     * @param {boolean} friend
     */
    constructor(user, friend = false) {
        if (friend) {
            this.friendConstructor(user);
        } else {
            this.userConstructor(user);
        }
    }

    userConstructor(user) {
        this.id = user.id;
        this.email = user.email;
        this.picture = user.picture;
        this.username = user.username;
    }

    friendConstructor(user) {
        this.id = user.id;
        this.picture = user.picture;
        this.username = user.username;
    }
}

module.exports = UserProfile;