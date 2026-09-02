import eventBus from "../helpers/eventBus.js";
import NotificationRepository from "../repositories/notificationRepository.js";
import FriendRepository from "../repositories/friendRepository.js";

export default class NotificationListener {

    constructor() {
        this._notificationRepository = new NotificationRepository();
        this._friendRepository = new FriendRepository();
        this.#register();
    }

    #register = () => {
        eventBus.on("show.started", this.#notifyFriends("show_started"));
        eventBus.on("show.rated", this.#notifyFriends("show_rated"));
        eventBus.on("season.watched", this.#notifyFriends("season_watched"));
        eventBus.on("episode.watched", this.#notifyFriends("episode_watched"));
        eventBus.on("episode.bulk_watched", this.#notifyFriends("episode_bulk_watched"));
        eventBus.on("actor.favorited", this.#notifyFriends("actor_favorited"));
        eventBus.on("friend.request", this.#notifyOne("friend_request"));
        eventBus.on("friend.accepted", this.#notifyOne("friend_accepted"));
        eventBus.on("friend.declined", this.#notifyOne("friend_declined"));
    }

    /**
     * @param {string} type
     * @returns {(payload: {actorUserId: string, showId?: number, metadata?: Object}) => Promise<void>}
     */
    #notifyFriends = (type) => async ({ actorUserId, showId, metadata }) => {
        const friends = await this._friendRepository.getFriends(actorUserId);

        await Promise.all(friends.map((friend) =>
            this._notificationRepository.create(friend.id, actorUserId, type, showId, metadata)
        ));
    }

    /**
     * @param {string} type
     * @returns {(payload: {recipientUserId: string, actorUserId: string, metadata?: Object}) => Promise<void>}
     */
    #notifyOne = (type) => async ({ recipientUserId, actorUserId, metadata }) =>
        this._notificationRepository.create(recipientUserId, actorUserId, type, undefined, metadata);
}
