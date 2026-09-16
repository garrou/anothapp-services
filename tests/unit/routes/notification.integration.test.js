import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../../../helpers/security.js";
import ServiceError from "../../../helpers/serviceError.js";

const notificationServiceMocks = vi.hoisted(() => ({
    getNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
}));

vi.mock("../../../services/notificationService.js", () => ({
    default: vi.fn().mockImplementation(function () { return notificationServiceMocks; }),
}));

let app;
let cookie;

beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    const module = await import("../../../config/app.js");
    app = module.default.app;
    cookie = `access_token=${SecurityHelper.signJwt("user-1", "test-secret")}`;
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /notifications", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).get("/notifications");
        expect(res.status).toBe(401);
    });

    it("returns the current user's notifications", async () => {
        notificationServiceMocks.getNotifications.mockResolvedValue([{id: 1, type: "friend_request"}]);

        const res = await request(app).get("/notifications").set("Cookie", cookie);

        expect(notificationServiceMocks.getNotifications).toHaveBeenCalledWith("user-1");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({notifications: [{id: 1, type: "friend_request"}]});
    });
});

describe("PATCH /notifications/:id/read", () => {
    it("marks a single notification as read", async () => {
        notificationServiceMocks.markAsRead.mockResolvedValue(undefined);

        const res = await request(app).patch("/notifications/1/read").set("Cookie", cookie);

        expect(notificationServiceMocks.markAsRead).toHaveBeenCalledWith("user-1", 1);
        expect(res.status).toBe(200);
    });

    it("returns 400 when the id is invalid", async () => {
        notificationServiceMocks.markAsRead.mockRejectedValue(new ServiceError(400, "Requête invalide"));

        const res = await request(app).patch("/notifications/abc/read").set("Cookie", cookie);

        expect(res.status).toBe(400);
    });
});

describe("PATCH /notifications/read", () => {
    it("marks all notifications as read", async () => {
        notificationServiceMocks.markAllAsRead.mockResolvedValue(undefined);

        const res = await request(app).patch("/notifications/read").set("Cookie", cookie);

        expect(notificationServiceMocks.markAllAsRead).toHaveBeenCalledWith("user-1");
        expect(res.status).toBe(200);
    });
});
