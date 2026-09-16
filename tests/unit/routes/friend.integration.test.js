import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../../../helpers/security.js";
import ServiceError from "../../../helpers/serviceError.js";

const friendServiceMocks = vi.hoisted(() => ({
    getFriends: vi.fn(),
    sendFriendRequest: vi.fn(),
    acceptFriend: vi.fn(),
    deleteFriend: vi.fn(),
}));

vi.mock("../../../services/friendService.js", () => ({
    default: vi.fn().mockImplementation(function () { return friendServiceMocks; }),
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

describe("GET /friends", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).get("/friends");
        expect(res.status).toBe(401);
    });

    it("returns the plain list when no status filter is given", async () => {
        friendServiceMocks.getFriends.mockResolvedValue([{id: "user-2", username: "bob"}]);

        const res = await request(app).get("/friends").set("Cookie", cookie);

        expect(friendServiceMocks.getFriends).toHaveBeenCalledWith("user-1", undefined, undefined);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{id: "user-2", username: "bob"}]);
    });

    it("wraps the list under the status key when a status filter is given", async () => {
        friendServiceMocks.getFriends.mockResolvedValue([{id: "user-2", username: "bob"}]);

        const res = await request(app).get("/friends").query({status: "pending"}).set("Cookie", cookie);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({pending: [{id: "user-2", username: "bob"}]});
    });
});

describe("POST /friends", () => {
    it("returns 200 on success", async () => {
        friendServiceMocks.sendFriendRequest.mockResolvedValue(undefined);

        const res = await request(app).post("/friends").set("Cookie", cookie).send({userId: "user-2"});

        expect(friendServiceMocks.sendFriendRequest).toHaveBeenCalledWith("user-1", "user-2");
        expect(res.status).toBe(200);
    });

    it("returns 409 when the users are already friends", async () => {
        friendServiceMocks.sendFriendRequest.mockRejectedValue(new ServiceError(409, "Déjà amis"));

        const res = await request(app).post("/friends").set("Cookie", cookie).send({userId: "user-2"});

        expect(res.status).toBe(409);
    });
});

describe("PATCH /friends/:userId", () => {
    it("returns 200 on success", async () => {
        friendServiceMocks.acceptFriend.mockResolvedValue(undefined);

        const res = await request(app).patch("/friends/user-2").set("Cookie", cookie).send({userId: "user-2"});

        expect(friendServiceMocks.acceptFriend).toHaveBeenCalledWith("user-1", "user-2", "user-2");
        expect(res.status).toBe(200);
    });
});

describe("DELETE /friends/:userId", () => {
    it("returns 204 on success", async () => {
        friendServiceMocks.deleteFriend.mockResolvedValue(undefined);

        const res = await request(app).delete("/friends/user-2").set("Cookie", cookie);

        expect(friendServiceMocks.deleteFriend).toHaveBeenCalledWith("user-1", "user-2");
        expect(res.status).toBe(204);
    });
});
