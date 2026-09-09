import PlaylistService from "../services/playlistService.js";

export default class PlaylistController {
    constructor() {
        this._playlistService = new PlaylistService();
    }

    getPlaylists = async (req, res, next) => {
        try {
            const {friendId} = req.query;
            const playlists = await this._playlistService.getPlaylists(req.userId, friendId);
            res.status(200).json(playlists);
        } catch (e) {
            next(e);
        }
    }

    getPlaylistById = async (req, res, next) => {
        try {
            const playlist = await this._playlistService.getPlaylistById(req.userId, Number(req.params.id));
            res.status(200).json(playlist);
        } catch (e) {
            next(e);
        }
    }

    createPlaylist = async (req, res, next) => {
        try {
            const {name, visible} = req.body;
            const playlist = await this._playlistService.createPlaylist(req.userId, name, visible);
            res.status(201).json(playlist);
        } catch (e) {
            next(e);
        }
    }

    updatePlaylist = async (req, res, next) => {
        try {
            const {name, visible} = req.body;
            await this._playlistService.updatePlaylist(req.userId, Number(req.params.id), {name, visible});
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    deletePlaylist = async (req, res, next) => {
        try {
            await this._playlistService.deletePlaylist(req.userId, Number(req.params.id));
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    addShowToPlaylist = async (req, res, next) => {
        try {
            const {showId} = req.body;
            await this._playlistService.addShowToPlaylist(req.userId, Number(req.params.id), showId);
            res.sendStatus(201);
        } catch (e) {
            next(e);
        }
    }

    removeShowFromPlaylist = async (req, res, next) => {
        try {
            await this._playlistService.removeShowFromPlaylist(req.userId, Number(req.params.id), Number(req.params.showId));
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }
}
