import PlaylistRepository from "../repositories/playlistRepository.js";
import PlaylistCollaboratorRepository from "../repositories/playlistCollaboratorRepository.js";
import FriendRepository from "../repositories/friendRepository.js";
import ShowService from "./showService.js";
import ServiceError from "../helpers/serviceError.js";
import eventBus from "../helpers/eventBus.js";
import {
    ERROR_INVALID_REQUEST, ERROR_NOT_FRIEND, PLAYLIST_NOT_FOUND,
    ERROR_ALREADY_COLLABORATOR, ERROR_COLLABORATOR_INVITE_NOT_FOUND,
} from "../constants/errors.js";

const MAX_NAME_LENGTH = 255;

export default class PlaylistService {

    constructor() {
        this._playlistRepository = new PlaylistRepository();
        this._playlistCollaboratorRepository = new PlaylistCollaboratorRepository();
        this._friendRepository = new FriendRepository();
        this._showService = new ShowService();
    }

    /**
     * @param {import("../models/playlist.js").default|null} playlist
     * @param {string} currentUserId
     */
    #assertOwner = (playlist, currentUserId) => {
        if (!playlist || playlist.userId !== currentUserId) {
            throw new ServiceError(400, PLAYLIST_NOT_FOUND);
        }
    }

    /**
     * @param {import("../models/playlist.js").default|null} playlist
     * @param {string} currentUserId
     * @returns {Promise<void>}
     */
    #assertCanEditShows = async (playlist, currentUserId) => {
        if (!playlist) {
            throw new ServiceError(400, PLAYLIST_NOT_FOUND);
        }
        if (playlist.userId === currentUserId) {
            return;
        }
        if (await this._playlistCollaboratorRepository.checkIsAcceptedCollaborator(playlist.id, currentUserId)) {
            return;
        }
        throw new ServiceError(400, PLAYLIST_NOT_FOUND);
    }

    /**
     * @param {string} currentUserId
     * @param {string?} friendId
     * @returns {Promise<import("../models/playlist.js").default[]>}
     */
    getPlaylists = async (currentUserId, friendId) => {
        if (friendId) {
            if (!await this._friendRepository.checkIfAlreadyFriend(currentUserId, friendId)) {
                throw new ServiceError(400, ERROR_NOT_FRIEND);
            }
            return this._playlistRepository.getVisibleByUserId(friendId);
        }
        const [owned, collaborating] = await Promise.all([
            this._playlistRepository.getByUserId(currentUserId),
            this._playlistRepository.getCollaboratingByUserId(currentUserId),
        ]);
        owned.forEach((playlist) => { playlist.role = "owner"; });
        collaborating.forEach((playlist) => { playlist.role = "collaborator"; });
        return [...owned, ...collaborating];
    }

    /**
     * @param {string} currentUserId
     * @param {string} id
     * @returns {Promise<{playlist: import("../models/playlist.js").default, shows: import("../models/show.js").default[]}>}
     */
    getPlaylistById = async (currentUserId, id) => {
        const playlist = await this._playlistRepository.getById(id);

        if (!playlist) {
            throw new ServiceError(400, PLAYLIST_NOT_FOUND);
        }
        if (playlist.userId === currentUserId) {
            playlist.role = "owner";
        } else if (await this._playlistCollaboratorRepository.checkIsAcceptedCollaborator(id, currentUserId)) {
            playlist.role = "collaborator";
        } else if (playlist.visible && await this._friendRepository.checkIfAlreadyFriend(currentUserId, playlist.userId)) {
            playlist.role = "viewer";
        } else {
            throw new ServiceError(400, PLAYLIST_NOT_FOUND);
        }
        const shows = await this._playlistRepository.getShowsByPlaylistId(id);
        return {playlist, shows};
    }

    /**
     * @param {string} currentUserId
     * @param {string} name
     * @param {boolean} visible
     * @returns {Promise<import("../models/playlist.js").default>}
     */
    createPlaylist = async (currentUserId, name, visible = false) => {
        const trimmed = name?.trim();

        if (!trimmed || trimmed.length > MAX_NAME_LENGTH) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const playlist = await this._playlistRepository.create(currentUserId, trimmed, !!visible);
        eventBus.emit("playlist.created", {actorUserId: currentUserId});
        return playlist;
    }

    /**
     * @param {string} currentUserId
     * @param {string} id
     * @param {{name: string?, visible: boolean?}} fields
     * @returns {Promise<void>}
     */
    updatePlaylist = async (currentUserId, id, {name, visible}) => {
        const playlist = await this._playlistRepository.getById(id);
        this.#assertOwner(playlist, currentUserId);

        const trimmed = name?.trim();

        if (name !== undefined && (!trimmed || trimmed.length > MAX_NAME_LENGTH)) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const updated = await this._playlistRepository.update(id, {name: trimmed, visible});

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier la playlist");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} id
     * @returns {Promise<void>}
     */
    deletePlaylist = async (currentUserId, id) => {
        const playlist = await this._playlistRepository.getById(id);
        this.#assertOwner(playlist, currentUserId);

        const deleted = await this._playlistRepository.delete(id);

        if (!deleted) {
            throw new ServiceError(500, "Impossible de supprimer la playlist");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} playlistId
     * @param {number?} showId
     * @returns {Promise<void>}
     */
    addShowToPlaylist = async (currentUserId, playlistId, showId) => {
        if (!showId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const playlist = await this._playlistRepository.getById(playlistId);
        await this.#assertCanEditShows(playlist, currentUserId);

        const show = await this._showService.ensureShowExists(showId);
        await this._playlistRepository.addShow(playlistId, show.id);
    }

    /**
     * @param {string} currentUserId
     * @param {string} playlistId
     * @param {number} showId
     * @returns {Promise<void>}
     */
    removeShowFromPlaylist = async (currentUserId, playlistId, showId) => {
        const playlist = await this._playlistRepository.getById(playlistId);
        await this.#assertCanEditShows(playlist, currentUserId);

        const removed = await this._playlistRepository.removeShow(playlistId, showId);

        if (!removed) {
            throw new ServiceError(500, "Impossible de retirer la série de la playlist");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} playlistId
     * @param {string?} friendUserId
     * @returns {Promise<void>}
     */
    inviteCollaborator = async (currentUserId, playlistId, friendUserId) => {
        if (!friendUserId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const playlist = await this._playlistRepository.getById(playlistId);
        this.#assertOwner(playlist, currentUserId);

        if (!await this._friendRepository.checkIfAlreadyFriend(currentUserId, friendUserId)) {
            throw new ServiceError(400, ERROR_NOT_FRIEND);
        }
        if (await this._playlistCollaboratorRepository.checkExists(playlistId, friendUserId)) {
            throw new ServiceError(400, ERROR_ALREADY_COLLABORATOR);
        }
        const invited = await this._playlistCollaboratorRepository.invite(playlistId, friendUserId);

        if (!invited) {
            throw new ServiceError(500, "Impossible d'inviter ce collaborateur");
        }
        eventBus.emit("playlist.collaborator_invited", {
            recipientUserId: friendUserId, actorUserId: currentUserId,
            metadata: {playlistId, playlistName: playlist.name},
        });
    }

    /**
     * @param {string} currentUserId
     * @param {string} playlistId
     * @returns {Promise<void>}
     */
    acceptCollaboratorInvite = async (currentUserId, playlistId) => {
        const playlist = await this._playlistRepository.getById(playlistId);

        if (!playlist) {
            throw new ServiceError(400, PLAYLIST_NOT_FOUND);
        }
        const accepted = await this._playlistCollaboratorRepository.accept(playlistId, currentUserId);

        if (!accepted) {
            throw new ServiceError(400, ERROR_COLLABORATOR_INVITE_NOT_FOUND);
        }
        eventBus.emit("playlist.collaborator_accepted", {
            recipientUserId: playlist.userId, actorUserId: currentUserId,
            metadata: {playlistId, playlistName: playlist.name},
        });
    }

    /**
     * @param {string} currentUserId
     * @param {string} playlistId
     * @param {string} targetUserId
     * @returns {Promise<void>}
     */
    removeCollaborator = async (currentUserId, playlistId, targetUserId) => {
        const playlist = await this._playlistRepository.getById(playlistId);

        if (!playlist) {
            throw new ServiceError(400, PLAYLIST_NOT_FOUND);
        }
        const isSelf = targetUserId === currentUserId;

        if (!isSelf) {
            this.#assertOwner(playlist, currentUserId);
        }
        const collaborator = await this._playlistCollaboratorRepository.getOne(playlistId, targetUserId);
        const removed = await this._playlistCollaboratorRepository.remove(playlistId, targetUserId);

        if (!removed) {
            throw new ServiceError(500, "Impossible de retirer ce collaborateur");
        }
        // Only notify the owner when a pending invite is declined - a voluntary departure after
        // accepting, or an owner-initiated removal, stays silent (same as unfriending).
        if (isSelf && collaborator && !collaborator.accepted) {
            eventBus.emit("playlist.collaborator_declined", {
                recipientUserId: playlist.userId, actorUserId: currentUserId,
                metadata: {playlistId, playlistName: playlist.name},
            });
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} playlistId
     * @returns {Promise<import("../models/playlistCollaborator.js").default[]>}
     */
    getCollaborators = async (currentUserId, playlistId) => {
        const playlist = await this._playlistRepository.getById(playlistId);

        if (!playlist) {
            throw new ServiceError(400, PLAYLIST_NOT_FOUND);
        }
        if (playlist.userId !== currentUserId
            && !await this._playlistCollaboratorRepository.checkIsAcceptedCollaborator(playlistId, currentUserId)) {
            throw new ServiceError(400, PLAYLIST_NOT_FOUND);
        }
        return this._playlistCollaboratorRepository.getByPlaylistId(playlistId);
    }
}
