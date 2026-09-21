export default class LoginChallenge {
    /**
     * @param {Object} row
     */
    constructor(row) {
        this.id = row.id;
        this.userId = row["user_id"];
        this.codeHash = row["code_hash"];
        this.expiresAt = row["expires_at"];
        this.attempts = row.attempts;
        this.confirmedAt = row["confirmed_at"];
        this.createdAt = row["created_at"];
    }
}
