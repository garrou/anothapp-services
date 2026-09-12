import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import NotificationRepository from "./notificationRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("NotificationRepository.create", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new NotificationRepository();
    });

    it("returns true when a row was inserted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.create("user-1", "user-2", "friend_request", 10, {foo: "bar"});

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO notifications"), ["user-1", "user-2", "friend_request", 10, JSON.stringify({foo: "bar"})]);
        expect(result).toBe(true);
    });

    it("defaults optional fields to null", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.create("user-1", null, "system", null, null);

        expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", null, "system", null, null]);
    });
});

describe("NotificationRepository.getByUserId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new NotificationRepository();
    });

    it("maps rows to Notification instances", async () => {
        db.query.mockResolvedValue({
            rows: [{id: 1, type: "friend_request", actor_user_id: "user-2", actor_username: "bob", actor_picture: "pic.png", show_id: null, metadata: null, created_at: "2024-01-01", read_at: null}],
        });

        const result = await repo.getByUserId("user-1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("FROM notifications"), ["user-1", 30]);
        expect(result).toEqual([{
            id: 1, type: "friend_request",
            actor: {id: "user-2", username: "bob", picture: "pic.png"},
            show: undefined, metadata: undefined, createdAt: "2024-01-01", read: false,
        }]);
    });

    it("uses the provided limit", async () => {
        db.query.mockResolvedValue({rows: []});

        await repo.getByUserId("user-1", 5);

        expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 5]);
    });
});

describe("NotificationRepository.markAsRead", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new NotificationRepository();
    });

    it("returns true when a row was marked read", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.markAsRead("user-1", 1);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE notifications"), [1, "user-1"]);
        expect(result).toBe(true);
    });

    it("returns false when nothing matched", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.markAsRead("user-1", 999);

        expect(result).toBe(false);
    });
});

describe("NotificationRepository.markAllAsRead", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new NotificationRepository();
    });

    it("calls the update query with the user id", async () => {
        db.query.mockResolvedValue({});

        await repo.markAllAsRead("user-1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE notifications"), ["user-1"]);
    });
});

describe("NotificationRepository.createUpcomingEpisodeReminders", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new NotificationRepository();
    });

    it("returns the number of reminders created", async () => {
        db.query.mockResolvedValue({rowCount: 3});

        const result = await repo.createUpcomingEpisodeReminders("2024-01-01");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO notifications"), ["2024-01-01"]);
        expect(result).toBe(3);
    });
});

describe("NotificationRepository.deleteOlderThanDays", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new NotificationRepository();
    });

    it("returns the number of deleted rows", async () => {
        db.query.mockResolvedValue({rowCount: 7});

        const result = await repo.deleteOlderThanDays(90);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM notifications"), [90]);
        expect(result).toBe(7);
    });
});
