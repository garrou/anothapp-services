import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../helpers/security.js";
import ServiceError from "../helpers/serviceError.js";
import { ERROR_BAD_PASSWORD } from "../constants/errors.js";

const userServiceMocks = vi.hoisted(() => ({
    getUsers: vi.fn(),
    getProfile: vi.fn(),
    updateUser: vi.fn(),
    requestDeletion: vi.fn(),
}));

vi.mock("../services/userService.js", () => ({
    default: vi.fn().mockImplementation(function () { return userServiceMocks; }),
}));

let app;
let cookie;

beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    const module = await import("../config/app.js");
    app = module.default.app;
    cookie = `access_token=${SecurityHelper.signJwt("user-1", "test-secret")}`;
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /users", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).get("/users").query({username: "bob"});
        expect(res.status).toBe(401);
    });

    it("returns 400 when username is missing (delegated to the service)", async () => {
        userServiceMocks.getUsers.mockRejectedValue(new ServiceError(400, "Requête invalide"));

        const res = await request(app).get("/users").set("Cookie", cookie);

        expect(res.status).toBe(400);
    });

    it("returns 200 with the matching users", async () => {
        userServiceMocks.getUsers.mockResolvedValue([{id: "user-2", username: "bob"}]);

        const res = await request(app).get("/users").query({username: "bob"}).set("Cookie", cookie);

        expect(userServiceMocks.getUsers).toHaveBeenCalledWith("user-1", "bob");
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{id: "user-2", username: "bob"}]);
    });
});

describe("GET /users/profile", () => {
    it("returns the current user's own profile", async () => {
        userServiceMocks.getProfile.mockResolvedValue({id: "user-1", username: "me"});

        const res = await request(app).get("/users/profile").set("Cookie", cookie);

        expect(userServiceMocks.getProfile).toHaveBeenCalledWith("user-1", true);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({id: "user-1", username: "me"});
    });
});

describe("GET /users/:id", () => {
    it("returns another user's profile", async () => {
        userServiceMocks.getProfile.mockResolvedValue({id: "user-2", username: "bob"});

        const res = await request(app).get("/users/user-2").set("Cookie", cookie);

        expect(userServiceMocks.getProfile).toHaveBeenCalledWith("user-2", false);
        expect(res.status).toBe(200);
    });

    it("returns 404 when the profile does not exist", async () => {
        userServiceMocks.getProfile.mockRejectedValue(new ServiceError(404, "Profil introuvable"));

        const res = await request(app).get("/users/unknown").set("Cookie", cookie);

        expect(res.status).toBe(404);
    });
});

describe("PATCH /users/me", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).patch("/users/me").send({image: "pic.png"});
        expect(res.status).toBe(401);
    });

    it("returns 200 with the update confirmation message", async () => {
        userServiceMocks.updateUser.mockResolvedValue("Image de profil définie");

        const res = await request(app).patch("/users/me").set("Cookie", cookie).send({image: "pic.png"});

        expect(res.status).toBe(200);
        expect(res.body).toEqual({message: "Image de profil définie"});
    });
});

describe("DELETE /users/me", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).delete("/users/me").send({password: "goodpassword"});
        expect(res.status).toBe(401);
    });

    it("returns 204 and clears auth cookies when the password is correct", async () => {
        userServiceMocks.requestDeletion.mockResolvedValue(undefined);

        const res = await request(app).delete("/users/me").set("Cookie", cookie).send({password: "goodpassword"});

        expect(userServiceMocks.requestDeletion).toHaveBeenCalledWith("user-1", "goodpassword");
        expect(res.status).toBe(204);
        expect(res.headers["set-cookie"].some((c) => c.startsWith("access_token=;"))).toBe(true);
    });

    it("returns 400 when the password is incorrect (delegated to the service)", async () => {
        userServiceMocks.requestDeletion.mockRejectedValue(new ServiceError(400, ERROR_BAD_PASSWORD));

        const res = await request(app).delete("/users/me").set("Cookie", cookie).send({password: "wrongpassword"});

        expect(res.status).toBe(400);
    });
});
