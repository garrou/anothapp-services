import eventBus from "../helpers/eventBus.js";
import AchievementService from "./achievementService.js";

const EPISODE_CODES = ["streak", "watch_time", "shows_completed"];
const SEASON_WATCHED_CODES = ["streak", "watch_time", "shows_started", "shows_completed", "countries", "kinds", "platforms"];
const SHOW_STARTED_CODES = ["shows_started", "countries", "kinds"];
const SHOW_RATED_CODES = ["notes_count"];
const FRIEND_ACCEPTED_CODES = ["friends_count"];
const WATCHED_WITH_CODES = ["friends_watched_with", "duo"];
const SHOW_FAVORITED_CODES = ["favorites_count"];
const PLAYLIST_CREATED_CODES = ["playlists_count"];

export default class AchievementListener {

    constructor() {
        this._achievementService = new AchievementService();
        this.#register();
    }

    #register = () => {
        eventBus.on("season.watched", this.#evaluate(SEASON_WATCHED_CODES, (p) => [p.actorUserId]));
        eventBus.on("season.watched_with", this.#evaluate(WATCHED_WITH_CODES, (p) => [p.actorUserId, ...p.recipientIds]));
        eventBus.on("episode.watched", this.#evaluate(EPISODE_CODES, (p) => [p.actorUserId]));
        eventBus.on("episode.bulk_watched", this.#evaluate(EPISODE_CODES, (p) => [p.actorUserId]));
        eventBus.on("show.started", this.#evaluate(SHOW_STARTED_CODES, (p) => [p.actorUserId]));
        eventBus.on("show.rated", this.#evaluate(SHOW_RATED_CODES, (p) => [p.actorUserId]));
        eventBus.on("friend.accepted", this.#evaluate(FRIEND_ACCEPTED_CODES, (p) => [p.actorUserId, p.recipientUserId]));
        eventBus.on("show.favorited", this.#evaluate(SHOW_FAVORITED_CODES, (p) => [p.actorUserId]));
        eventBus.on("playlist.created", this.#evaluate(PLAYLIST_CREATED_CODES, (p) => [p.actorUserId]));
    }

    /**
     * @param {string[]} codes
     * @param {(payload: Object) => string[]} pickUserIds
     * @returns {(payload: Object) => Promise<void>}
     */
    #evaluate = (codes, pickUserIds) => async (payload) => {
        await Promise.all(pickUserIds(payload).map((userId) => this._achievementService.evaluate(userId, codes)));
    }
}
