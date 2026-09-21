export default class UserAuth {
    
    /**
     * @param {Object} row
     */
    constructor(row) {
        this.userId = row["user_id"];
        this.email = row.email;
        this.password = row["password_hash"];
        this.emailVerified = row["email_verified"];
        this.pendingEmail = row["pending_email"];
    }

    /**
     * @param {string} field
     * @return boolean
     */
    static isValidField = (field) => {
        return ["password_hash", "email_verified", "pending_email"].includes(field);
    }
}
