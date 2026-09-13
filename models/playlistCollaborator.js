export default class PlaylistCollaborator {

    /**
     * @param {Object} row
     */
    constructor(row) {
        this.id = row.id;
        this.username = row.username;
        this.picture = row.picture;
        this.accepted = row.accepted;
        this.invitedAt = row["invited_at"];
    }
}
