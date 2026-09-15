export default class PlaylistInvitation {

    /**
     * @param {Object} row
     */
    constructor(row) {
        this.playlistId = row["playlist_id"];
        this.playlistName = row["playlist_name"];
        this.invitedAt = row["invited_at"];
        this.ownerId = row["owner_id"];
        this.ownerUsername = row["owner_username"];
        this.ownerPicture = row["owner_picture"];
    }
}
