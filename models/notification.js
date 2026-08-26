export default class Notification {

    /**
     * @param {Object} row
     */
    constructor(row) {
        this.id = row.id;
        this.type = row.type;
        this.actor = row["actor_user_id"] ? {
            id: row["actor_user_id"],
            username: row["actor_username"],
            picture: row["actor_picture"],
        } : undefined;
        this.show = row["show_id"] ? {
            id: row["show_id"],
            title: row["show_title"],
            poster: row["show_poster"],
        } : undefined;
        this.metadata = row.metadata ?? undefined;
        this.createdAt = row["created_at"];
        this.read = !!row["read_at"];
    }
}
