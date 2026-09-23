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
        eventBus.on("season.watched_with", this.#notifyList("season_watched_with"));
        eventBus.on("season.watched_with.accepted", this.#notifyOne("season_watched_with_accepted"));
        eventBus.on("season.watched_with.declined", this.#notifyOne("season_watched_with_declined"));
        eventBus.on("episode.watched", this.#notifyFriends("episode_watched"));
        eventBus.on("episode.bulk_watched", this.#notifyFriends("episode_bulk_watched"));
        eventBus.on("actor.favorited", this.#notifyFriends("actor_favorited"));
        eventBus.on("friend.request", this.#notifyOne("friend_request"));
        eventBus.on("friend.accepted", this.#notifyOne("friend_accepted"));
        eventBus.on("friend.declined", this.#notifyOne("friend_declined"));
        eventBus.on("playlist.collaborator_invited", this.#notifyOne("playlist_collaborator_invited"));
        eventBus.on("playlist.collaborator_accepted", this.#notifyOne("playlist_collaborator_accepted"));
        eventBus.on("playlist.collaborator_declined", this.#notifyOne("playlist_collaborator_declined"));
        eventBus.on("playlist.show_added", this.#notifyOne("playlist_show_added"));
        eventBus.on("playlist.show_removed", this.#notifyOne("playlist_show_removed"));
        eventBus.on("achievement.league_unlocked", this.#notifyFriends("achievement_league_unlocked"));
    }

    /**
     * @param {string} type
     * @returns {(payload: {actorUserId: string, showId?: number, metadata?: Object, excludeUserIds?: string[]}) => Promise<void>}
     */
    #notifyFriends = (type) => async ({ actorUserId, showId, metadata, excludeUserIds = [] }) => {
        const friends = await this._friendRepository.getFriends(actorUserId);
        const excluded = new Set(excludeUserIds);

        await Promise.all(friends
            .filter((friend) => !excluded.has(friend.id))
            .map((friend) => this._notificationRepository.create(friend.id, actorUserId, type, showId, metadata))
        );
    }

    /**
     * @param {string} type
     * @returns {(payload: {recipientUserId: string, actorUserId: string, showId?: number, metadata?: Object}) => Promise<void>}
     */
    #notifyOne = (type) => async ({ recipientUserId, actorUserId, showId, metadata }) =>
        this._notificationRepository.create(recipientUserId, actorUserId, type, showId, metadata);

    /**
     * @param {string} type
     * @returns {(payload: {actorUserId: string, recipientIds: string[], showId?: number, metadata?: Object}) => Promise<void>}
     */
    #notifyList = (type) => async ({ actorUserId, recipientIds, showId, metadata }) =>
        Promise.all(recipientIds.map((recipientId) =>
            this._notificationRepository.create(recipientId, actorUserId, type, showId, metadata)
        ));
}
