import AchievementService from "../services/achievementService.js";

export default class AchievementController {

    constructor() {
        this._achievementService = new AchievementService();
    }

    getAchievements = async (req, res, next) => {
        try {
            const achievements = await this._achievementService.getAchievements(req.userId);
            res.status(200).json({achievements});
        } catch (e) {
            next(e);
        }
    }
}
