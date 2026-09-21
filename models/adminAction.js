export default class AdminAction {
    /**
     * @param {Object} row
     */
    constructor(row) {
        this.id = row.id;
        this.adminUserId = row["admin_user_id"];
        this.action = row.action;
        this.targetUserId = row["target_user_id"];
        this.createdAt = row["created_at"];
    }
}
