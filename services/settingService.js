import UserShowRepository from "../repositories/userShowRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import UserEpisodeRepository from "../repositories/userEpisodeRepository.js";
import FriendRepository from "../repositories/friendRepository.js";
import UserFavoriteActorRepository from "../repositories/userFavoriteActorRepository.js";
import UserPlatformRepository from "../repositories/userPlatformRepository.js";
import PlaylistRepository from "../repositories/playlistRepository.js";
import {ExportData, ExportShow} from "../models/exportData.js";
import StatService from "./statService.js";
import UserService from "./userService.js";
import PlaylistService from "./playlistService.js";
import AchievementService from "./achievementService.js";
import ServiceError from "../helpers/serviceError.js";
import {TOO_MUCH_EXPORT_REQUEST} from "../constants/errors.js";

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
        return [filename, exportedData];
    }
}