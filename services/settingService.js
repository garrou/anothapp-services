import UserShowRepository from "../repositories/userShowRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import UserEpisodeRepository from "../repositories/userEpisodeRepository.js";
import FriendRepository from "../repositories/friendRepository.js";
import UserFavoriteActorRepository from "../repositories/userFavoriteActorRepository.js";
import UserPlatformRepository from "../repositories/userPlatformRepository.js";
import PlaylistRepository from "../repositories/playlistRepository.js";
import ActorRepository from "../repositories/actorRepository.js";
import {ExportData, ExportShow} from "../models/exportData.js";
import StatService from "./statService.js";
import UserService from "./userService.js";
import PlaylistService from "./playlistService.js";
import AchievementService from "./achievementService.js";
import ShowService from "./showService.js";
import EpisodeService from "./episodeService.js";
import ServiceError from "../helpers/serviceError.js";
import {DUPLICATE_ERROR_CODE, ERROR_INVALID_REQUEST, TOO_MUCH_EXPORT_REQUEST} from "../constants/errors.js";
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
        this._actorRepository = new ActorRepository();
        this._statService = new StatService();
        this._playlistService = new PlaylistService();
        this._playlistRepository = new PlaylistRepository();
        this._achievementService = new AchievementService();
        this._showService = new ShowService();
        this._episodeService = new EpisodeService();
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
        return [filename, exportedData];
    }

    /**
     * @param {string} userId
     * @param {ExportShow} show
     * @returns {Promise<void>}
     */
    #importShow = async (userId, show) => {
        await this._showService.ensureShowExistsFromImport(show);

        const alreadyInCollection = await this._userShowRepository.checkShowExistsByUserIdByShowId(userId, show.id);

        if (!alreadyInCollection) {
            await this._userShowRepository.create(userId, show.id, {
                favorite: show.isFavorite, watch: show.isWatching, note: show.note, addedAt: show.addedAt,
            });
        }
        for (const season of show.seasons ?? []) {
            await this.#importSeason(userId, show.id, season);
        }
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @param {UserSeason} season one exported viewing - a rewatch of the same season is a separate entry
     * @returns {Promise<void>}
     */
    #importSeason = async (userId, showId, season) => {
        await this._showService.ensureSeasonExistsFromImport(showId, season);

        const alreadyImported = await this._userSeasonRepository.findImportedViewing(
            userId, showId, season.number, season.addedAt
        );
        const userSeasonId = alreadyImported ?? await this._userSeasonRepository.create(
            userId, showId, season.number, season.platformId, season.addedAt
        );

        for (const episode of season.episodes ?? []) {
            await this._episodeService.upsertEpisodeFromImport(showId, season.number, {
                id: episode.episodeId, number: episode.number, title: episode.title, code: episode.code,
                global: episode.global, length: episode.length, date: episode.date, description: episode.description,
            });
            await this._userEpisodeRepository.createIfMissing(
                userId, userSeasonId, episode.episodeId, episode.watchedAt ?? season.addedAt, season.platformId
            );
        }
    }

    /**
     * Only playlists the exporting user owned are recreated - collaborator invites can't be
     * recreated unilaterally (see the export/import plan's decision on this).
     * @param {string} userId
     * @param {Object} playlist
     * @returns {Promise<void>}
     */
    #importPlaylist = async (userId, playlist) => {
        if (playlist.role && playlist.role !== "owner") {
            return;
        }
        const created = await this._playlistRepository.create(userId, playlist.name, !!playlist.visible);

        for (const show of playlist.shows ?? []) {
            await this._showService.ensureShowExistsFromImport(show);
            await this._playlistRepository.addShow(created.id, show.id);
        }
    }

    /**
     * @param {string} userId
     * @param {Actor} actor
     * @returns {Promise<void>}
     */
    #importFavoriteActor = async (userId, actor) => {
        const existingActor = await this._actorRepository.getActorById(actor.id);

        if (!existingActor) {
            await this._actorRepository.createActor(
                actor.id, actor.name, actor.picture, actor.birthday, actor.deathday, actor.nationality, actor.description
            );
        }
        const alreadyFavorite = await this._userFavoriteActorRepository.checkFavoriteExists(userId, actor.id);

        if (!alreadyFavorite) {
            await this._userFavoriteActorRepository.create(userId, actor.id);
        }
    }

    /**
     * Re-imports a previously exported ExportData. The target account (userId, always the
     * currently authenticated user) is never modified by this: friends, playlist collaborators,
     * and the export's own `user` block (username/email/password/picture) are never read here.
     * @param {string} userId
     * @param {Object} payload
     * @returns {Promise<Object>} a per-category summary of what was imported
     */
    importData = async (userId, payload) => {
        if (!payload || typeof payload !== "object" || !Array.isArray(payload.shows)) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const shows = payload.shows ?? [];
        const playlists = payload.playlists ?? [];
        const favoriteActors = payload.favoriteActors ?? [];
        const platforms = payload.platforms ?? [];

        const summary = {
            shows: {imported: 0, errors: 0},
            playlists: {imported: 0, errors: 0},
            favoriteActors: {imported: 0, errors: 0},
            platforms: {imported: 0, errors: 0},
            errors: [],
        };

        await mapWithConcurrency(shows, CONCURRENCY, async (show) => {
            try {
                await this.#importShow(userId, show);
                summary.shows.imported++;
            } catch (err) {
                summary.shows.errors++;
                summary.errors.push(`Série "${show.title}" : ${err.message}`);
            }
        });

        await mapWithConcurrency(playlists, CONCURRENCY, async (playlist) => {
            try {
                await this.#importPlaylist(userId, playlist);
                summary.playlists.imported++;
            } catch (err) {
                summary.playlists.errors++;
                summary.errors.push(`Playlist "${playlist.name}" : ${err.message}`);
            }
        });

        await mapWithConcurrency(favoriteActors, CONCURRENCY, async (actor) => {
            try {
                await this.#importFavoriteActor(userId, actor);
                summary.favoriteActors.imported++;
            } catch (err) {
                summary.favoriteActors.errors++;
                summary.errors.push(`Acteur "${actor.name}" : ${err.message}`);
            }
        });

        await mapWithConcurrency(platforms, CONCURRENCY, async (platformId) => {
            try {
                await this._userPlatformRepository.addUserPlatforms(userId, platformId);
                summary.platforms.imported++;
            } catch (err) {
                if (err.code !== DUPLICATE_ERROR_CODE) {
                    summary.platforms.errors++;
                    summary.errors.push(`Plateforme ${platformId} : ${err.message}`);
                }
            }
        });

        await this._achievementService.evaluate(userId);

        return summary;
    }
}