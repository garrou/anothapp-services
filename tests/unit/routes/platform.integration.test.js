import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../../../helpers/security.js";
import ServiceError from "../../../helpers/serviceError.js";

const userPlatformServiceMocks = vi.hoisted(() => ({
    getUserPlatforms: vi.fn(),
    addUserPlatforms: vi.fn(),
    deleteUserPlatform: vi.fn(),
}));

vi.mock("../../../services/userPlatformService.js", () => ({
    default: vi.fn().mockImplementation(function () { return userPlatformServiceMocks; }),
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

describe("GET /platforms", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).get("/platforms");
        expect(res.status).toBe(401);
    });

    it("returns the current user's platforms", async () => {
        userPlatformServiceMocks.getUserPlatforms.mockResolvedValue([1, 2]);

        const res = await request(app).get("/platforms").set("Cookie", cookie);

        expect(userPlatformServiceMocks.getUserPlatforms).toHaveBeenCalledWith("user-1", undefined);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([1, 2]);
    });

    it("returns 400 when requesting a non-friend's platforms", async () => {
        userPlatformServiceMocks.getUserPlatforms.mockRejectedValue(new ServiceError(400, "Vous n'êtes pas ami avec cet utilisateur"));

        const res = await request(app).get("/platforms").query({friendId: "user-2"}).set("Cookie", cookie);

        expect(userPlatformServiceMocks.getUserPlatforms).toHaveBeenCalledWith("user-1", "user-2");
        expect(res.status).toBe(400);
    });
});

describe("POST /platforms", () => {
    it("returns 200 with a confirmation message", async () => {
        userPlatformServiceMocks.addUserPlatforms.mockResolvedValue(undefined);

        const res = await request(app).post("/platforms").set("Cookie", cookie).send({platformId: 1});

        expect(userPlatformServiceMocks.addUserPlatforms).toHaveBeenCalledWith("user-1", 1);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({message: "Plateforme ajoutée"});
    });
});

describe("DELETE /platforms/:id", () => {
    it("returns 200 with a confirmation message", async () => {
        userPlatformServiceMocks.deleteUserPlatform.mockResolvedValue(undefined);

        const res = await request(app).delete("/platforms/1").set("Cookie", cookie);

        expect(userPlatformServiceMocks.deleteUserPlatform).toHaveBeenCalledWith("user-1", "1");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({message: "Plateforme supprimée"});
    });
});
