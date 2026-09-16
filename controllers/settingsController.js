import SettingService from "../services/settingService.js";

export default class SettingsController {

    constructor() {
        this._settingService = new SettingService();
    }

    exportData = async (req, res, next) => {
        try {
            const [filename, data] = await this._settingService.exportData(req.userId);
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.json(data);
        } catch (e) {
            next(e);
        }
    }

    importData = async (req, res, next) => {
        try {
            const summary = await this._settingService.importData(req.userId, req.body);
            res.json(summary);
        } catch (e) {
            next(e);
        }
    }
}