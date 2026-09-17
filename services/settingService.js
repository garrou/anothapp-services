import UserShowRepository from "../repositories/userShowRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import UserEpisodeRepository from "../repositories/userEpisodeRepository.js";
import FriendRepository from "../repositories/friendRepository.js";
import UserFavoriteActorRepository from "../repositories/userFavoriteActorRepository.js";
import UserPlatformRepository from "../repositories/userPlatformRepository.js";
import PlaylistRepository from "../repositories/playlistRepository.js";
import { ExportData, ExportShow } from "../models/exportData.js";
import UserUpdate from "../models/userUpdate.js";
import Validator from "../helpers/validator.js";
import SecurityHelper from "../helpers/security.js";
import StatService from "./statService.js";
import UserService from "./userService.js";
import PlaylistService from "./playlistService.js";
import AchievementService from "./achievementService.js";
import ServiceError from "../helpers/serviceError.js";
import {
    DUPLICATE_ERROR_CODE, ERROR_INVALID_REQUEST, ERROR_INVALID_SIGNATURE, TOO_MUCH_EXPORT_REQUEST
} from "../constants/errors.js";
import mapWithConcurrency from "../schedule/lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

export default class SettingService {

    constructor() {
        this._userService = new UserService();
        this._userShowRepository = new UserShowRepository();
        this._userSeasonRepository = new UserSeasonRepository();
        this._userEpisodeRepository = new UserEpisodeRepository();
        this._friendRepository = new FriendRepository();
        this._userFavoriteActorRepository = new UserFavoriteActorRepository();
        this._userPlatformRepository = new UserPlatformRepository();
        this._statService = new StatService();
        this._playlistService = new PlaylistService();
        this._playlistRepository = new PlaylistRepository();
        this._achievementService = new AchievementService();
    }

    /**
     * @param {string} userId
     * @returns {Promise<[string, ExportData]>}
     */
    exportData = async (userId) => {
        const canExport = await this._userService.markExported(userId);

        if (!canExport) {
            throw new ServiceError(400, TOO_MUCH_EXPORT_REQUEST);
        }
        const [
            user, shows, seasons, episodes, stats, friends, playlists, favoriteActors, platforms, achievements
        ] = await Promise.all([
            this._userService.getUser(userId),
            this._userShowRepository.getShowsByUserId(userId, undefined, [], [], [], []),
            this._userSeasonRepository.getUserSeasonsByUserId(userId),
            this._userEpisodeRepository.getAllByUserId(userId),
            this._statService.getStats(userId),
            this._friendRepository.getFriends(userId),
            this._playlistService.getPlaylists(userId),
            this._userFavoriteActorRepository.getFavoritesByUserId(userId),
            this._userPlatformRepository.getUserPlatforms(userId),
            this._achievementService.getAchievements(userId),
        ]);
        const playlistsShows = await Promise.all(
            playlists.map((playlist) => this._playlistRepository.getShowsByPlaylistId(playlist.id))
        );
        playlists.forEach((playlist, i) => { playlist.shows = playlistsShows[i]; });

        const exportedData = new ExportData(user, stats);
        exportedData.friends = friends;
        exportedData.playlists = playlists;
        exportedData.favoriteActors = favoriteActors;
        exportedData.platforms = platforms;
        exportedData.achievements = achievements;

        for (const show of shows) {
            const exportedShow = new ExportShow(show);
            for (let i = 0; i < seasons.length; i++) {
                if (seasons[i].showId === show.id) {
                    const season = seasons[i];
                    season.episodes = episodes
                        .filter((e) => e.userSeasonId === season.id)
                        .map((e) => e.episode);
                    exportedShow.seasons.push(season);
                }
            }
            exportedData.shows.push(exportedShow);
        }
        const date = new Date().toISOString().split('T')[0];
        const filename = `user-data-${userId}-${date}.json`;
        const normalizedData = JSON.parse(JSON.stringify(exportedData));
        normalizedData.signature = SecurityHelper.signExportData(normalizedData);
        return [filename, normalizedData];
    }

    /**
     * @param {string} userId
     * @param {Object} payload
     * @returns {Promise<Object>} a per-category summary of what was imported
     */
    importData = async (userId, payload) => {
        if (!Validator.isValidImportFile(payload)) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        if (!SecurityHelper.verifyExportSignature(payload)) {
            throw new ServiceError(400, ERROR_INVALID_SIGNATURE);
        }
        const shows = payload.shows ?? [];
        const playlists = payload.playlists ?? [];
        const favoriteActors = payload.favoriteActors ?? [];
        const platforms = payload.platforms ?? [];
        const episodeTrackingEnabled = payload.user?.episodeTrackingEnabled;

        const summary = {
            shows: { imported: 0, errors: 0 },
            playlists: { imported: 0, errors: 0 },
            favoriteActors: { imported: 0, errors: 0 },
            platforms: { imported: 0, errors: 0 },
            errors: [],
        };

        await mapWithConcurrency(shows, CONCURRENCY, async (show) => {
            try {
                await this.#importShow(userId, show);
                summary.shows.imported++;
            } catch (err) {
                summary.shows.errors++;
                summary.errors.push(`Série "${show?.title ?? "?"}" : ${err.message}`);
            }
        });

        await mapWithConcurrency(playlists, CONCURRENCY, async (playlist) => {
            try {
                await this.#importPlaylist(userId, playlist);
                summary.playlists.imported++;
            } catch (err) {
                summary.playlists.errors++;
                summary.errors.push(`Playlist "${playlist?.name ?? "?"}" : ${err.message}`);
            }
        });

        await mapWithConcurrency(favoriteActors, CONCURRENCY, async (actor) => {
            try {
                await this.#importFavoriteActor(userId, actor);
                summary.favoriteActors.imported++;
            } catch (err) {
                summary.favoriteActors.errors++;
                summary.errors.push(`Acteur "${actor?.name ?? "?"}" : ${err.message}`);
            }
        });

        await mapWithConcurrency(platforms, CONCURRENCY, async (platformId) => {
            try {
                if (!Validator.isValidImportedPlatformId(platformId)) {
                    throw new Error("Plateforme invalide");
                }
                await this._userPlatformRepository.addUserPlatforms(userId, platformId);
                summary.platforms.imported++;
            } catch (err) {
                if (err.code !== DUPLICATE_ERROR_CODE) {
                    summary.platforms.errors++;
                    summary.errors.push(`Plateforme ${platformId} : ${err.message}`);
                }
            }
        });

        try {
            await this.#importEpisodeTrackingPreference(userId, episodeTrackingEnabled);
        } catch (err) {
            summary.errors.push(`Suivi des épisodes : ${err.message}`);
        }

        await this._achievementService.evaluate(userId);

        return summary;
    }

    /**
     * Only writes to the user's own collection - shows/seasons/episodes/actors are the shared
     * catalog, populated exclusively from Betaseries. A show only ever appears in an export
     * because it was already joined against that catalog, so it's guaranteed to exist here too;
     * if it somehow doesn't (e.g. a payload edited by hand), the FK constraint on users_shows
     * rejects the row and this show is reported as a failure instead of fabricating catalog data.
     * @param {string} userId
     * @param {ExportShow} show
     * @returns {Promise<void>}
     */
    #importShow = async (userId, show) => {
        if (!Validator.isValidImportedShow(show)) {
            throw new Error("Série invalide");
        }
        const alreadyInCollection = await this._userShowRepository.checkShowExistsByUserIdByShowId(userId, show.id);

        if (!alreadyInCollection) {
            await this._userShowRepository.create(userId, show.id, {
                favorite: show.isFavorite, watch: show.isWatching, note: show.note, addedAt: show.addedAt,
            });
        }
        await Promise.all((show.seasons ?? []).map((season) => this.#importSeason(userId, show.id, season)));
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @param {UserSeason} season one exported viewing - a rewatch of the same season is a separate entry
     * @returns {Promise<void>}
     */
    #importSeason = async (userId, showId, season) => {
        if (!Validator.isValidImportedSeason(season)) {
            throw new Error("Saison invalide");
        }
        const alreadyImported = await this._userSeasonRepository.findImportedViewing(
            userId, showId, season.number, season.addedAt
        );
        const userSeasonId = alreadyImported ?? await this._userSeasonRepository.create(
            userId, showId, season.number, season.platformId, season.addedAt
        );

        await Promise.all((season.episodes ?? []).map(async (episode) => {
            if (!Validator.isValidImportedEpisode(episode)) {
                throw new Error("Épisode invalide");
            }
            await this._userEpisodeRepository.createIfMissing(
                userId, userSeasonId, episode.episodeId, episode.watchedAt ?? season.addedAt, season.platformId
            );
        }));
    }

    /**
     * Only playlists the exporting user owned are recreated - collaborator invites can't be
     * recreated unilaterally (see the export/import plan's decision on this).
     * @param {string} userId
     * @param {Object} playlist
     * @returns {Promise<void>}
     */
    #importPlaylist = async (userId, playlist) => {
        if (!Validator.isValidImportedPlaylist(playlist)) {
            throw new Error("Playlist invalide");
        }
        if (playlist.role && playlist.role !== "owner") {
            return;
        }
        const existing = await this._playlistRepository.getByUserIdAndName(userId, playlist.name);
        const target = existing ?? await this._playlistRepository.create(userId, playlist.name, !!playlist.visible);

        await Promise.all((playlist.shows ?? []).map(async (show) => {
            if (!Validator.isValidImportedShow(show)) {
                throw new Error("Série de playlist invalide");
            }
            await this._playlistRepository.addShow(target.id, show.id);
        }));
    }

    /**
     * @param {string} userId
     * @param {Actor} actor
     * @returns {Promise<void>}
     */
    #importFavoriteActor = async (userId, actor) => {
        if (!Validator.isValidImportedActor(actor)) {
            throw new Error("Acteur invalide");
        }
        const alreadyFavorite = await this._userFavoriteActorRepository.checkFavoriteExists(userId, actor.id);

        if (!alreadyFavorite) {
            await this._userFavoriteActorRepository.create(userId, actor.id);
        }
    }

    /**
     * @param {string} userId
     * @param {boolean?} episodeTrackingEnabled
     * @returns {Promise<void>}
     */
    #importEpisodeTrackingPreference = async (userId, episodeTrackingEnabled) => {
        if (!Validator.isBoolean(episodeTrackingEnabled)) {
            return;
        }
        await this._userService.updateUser(userId, new UserUpdate({ episodeTrackingEnabled }), { skipBackfill: true });
    }
}