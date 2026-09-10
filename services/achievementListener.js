import eventBus from "../helpers/eventBus.js";
import AchievementService from "./achievementService.js";

export default class AchievementListener {

    constructor() {
        this._achievementService = new AchievementService();
        this.#register();
    }

    #register = () => {
        eventBus.on("season.watched", this.#evaluate((p) => [p.actorUserId]));
        eventBus.on("season.watched_with", this.#evaluate((p) => [p.actorUserId, ...p.recipientIds]));
        eventBus.on("episode.watched", this.#evaluate((p) => [p.actorUserId]));
        eventBus.on("episode.bulk_watched", this.#evaluate((p) => [p.actorUserId]));
        eventBus.on("show.started", this.#evaluate((p) => [p.actorUserId]));
        eventBus.on("show.rated", this.#evaluate((p) => [p.actorUserId]));
        eventBus.on("friend.accepted", this.#evaluate((p) => [p.actorUserId, p.recipientUserId]));
    }

    /**
     * @param {(payload: Object) => string[]} pickUserIds
     * @returns {(payload: Object) => Promise<void>}
     */
    #evaluate = (pickUserIds) => async (payload) => {
        await Promise.all(pickUserIds(payload).map((userId) => this._achievementService.evaluate(userId)));
    }
}
