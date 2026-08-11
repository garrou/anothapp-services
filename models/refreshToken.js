export default class RefreshToken {

    /**
     * @param {Object} token
     */
    constructor(token) {
        this.id = token.id;
        this.userId = token["user_id"];
        this.tokenHash = token["token_hash"];
        this.expiresAt = token["expires_at"];
        this.revokedAt = token["revoked_at"];
        this.createdAt = token["created_at"];
    }
}
