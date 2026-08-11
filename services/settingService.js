import UserShowRepository from "../repositories/userShowRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import {ExportData, ExportShow} from "../models/exportData.js";
import StatService from "./statService.js";
import UserService from "./userService.js";
import ServiceError from "../helpers/serviceError.js";
import {TOO_MUCH_EXPORT_REQUEST} from "../constants/errors.js";

export default class SettingService {

    constructor() {
        this._userService = new UserService();
        this._userShowRepository = new UserShowRepository();
        this._userSeasonRepository = new UserSeasonRepository();
        this._statService = new StatService();
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
        const user = await this._userService.getUser(userId);
        const shows = await this._userShowRepository.getShowsByUserId(userId, undefined, [], [], [], []);
        const seasons = await this._userSeasonRepository.getUserSeasonsByUserId(userId);
        const stats = await this._statService.getStats(userId);
        const exportedData = new ExportData(user, stats);

        for (const show of shows) {
            const exportedShow = new ExportShow(show);
            for (let i = 0; i < seasons.length; i++) {
                if (seasons[i].showId === show.id) {
                    exportedShow.seasons.push(seasons[i]);
                }
            }
            exportedData.shows.push(exportedShow);
        }
        const date = new Date().toISOString().split('T')[0];
        const filename = `user-data-${userId}-${date}.json`;
        return [filename, exportedData];
    }
}