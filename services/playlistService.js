import PlaylistRepository from "../repositories/playlistRepository.js";
import FriendRepository from "../repositories/friendRepository.js";
import ShowService from "./showService.js";
import ServiceError from "../helpers/serviceError.js";
import {ERROR_INVALID_REQUEST} from "../constants/errors.js";

const MAX_NAME_LENGTH = 255;

export default class PlaylistService {

    constructor() {
        this._playlistRepository = new PlaylistRepository();
        this._friendRepository = new FriendRepository();
        this._showService = new ShowService();
    }

    /**
     * @param {import("../models/playlist.js").default|null} playlist
     * @param {string} currentUserId
     */
    #assertOwner = (playlist, currentUserId) => {
        if (!playlist || playlist.userId !== currentUserId) {
            throw new ServiceError(400, "Cette playlist ne vous appartient pas");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string?} friendId
     * @returns {Promise<import("../models/playlist.js").default[]>}
     */
    getPlaylists = async (currentUserId, friendId) => {
        if (friendId) {
            if (!await this._friendRepository.checkIfAlreadyFriend(currentUserId, friendId)) {
                throw new ServiceError(400, "Vous n'êtes pas en relation avec cette personne");
            }
            return this._playlistRepository.getVisibleByUserId(friendId);
        }
        return this._playlistRepository.getByUserId(currentUserId);
    }

    /**
     * @param {string} currentUserId
     * @param {number} id
     * @returns {Promise<{playlist: import("../models/playlist.js").default, shows: import("../models/show.js").default[]}>}
     */
    getPlaylistById = async (currentUserId, id) => {
        const playlist = await this._playlistRepository.getById(id);

        if (!playlist) {
            throw new ServiceError(400, "Playlist introuvable");
        }
        if (playlist.userId !== currentUserId) {
            if (!playlist.visible || !await this._friendRepository.checkIfAlreadyFriend(currentUserId, playlist.userId)) {
                throw new ServiceError(400, "Vous n'avez pas accès à cette playlist");
            }
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
        return this._playlistRepository.create(currentUserId, trimmed, !!visible);
    }

    /**
     * @param {string} currentUserId
     * @param {number} id
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
     * @param {number} id
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
     * @param {number} playlistId
     * @param {number?} showId
     * @returns {Promise<void>}
     */
    addShowToPlaylist = async (currentUserId, playlistId, showId) => {
        if (!showId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const playlist = await this._playlistRepository.getById(playlistId);
        this.#assertOwner(playlist, currentUserId);

        const show = await this._showService.ensureShowExists(showId);
        await this._playlistRepository.addShow(playlistId, show.id);
    }

    /**
     * @param {string} currentUserId
     * @param {number} playlistId
     * @param {number} showId
     * @returns {Promise<void>}
     */
    removeShowFromPlaylist = async (currentUserId, playlistId, showId) => {
        const playlist = await this._playlistRepository.getById(playlistId);
        this.#assertOwner(playlist, currentUserId);

        const removed = await this._playlistRepository.removeShow(playlistId, showId);

        if (!removed) {
            throw new ServiceError(500, "Impossible de retirer la série de la playlist");
        }
    }
}
