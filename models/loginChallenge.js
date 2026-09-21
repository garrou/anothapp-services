/**
 * A single login-code attempt (`login_challenges` table) - one row per AuthService.login() call.
 * History is kept on purpose (see AuthService.confirmLogin's comments): only the most recent row
 * for an account is ever valid, older ones are inert but left in place for debugging, until the
 * cleanupLoginChallenges schedule task purges rows past the retention window.
 */
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
