import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import SecurityHelper from "../helpers/security.js";

const userRepoMocks = vi.hoisted(() => ({
    getUserByIdentifier: vi.fn(),
    createUser: vi.fn(),
}));
const refreshRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
    find: vi.fn(),
    revoke: vi.fn(),
}));

vi.mock("../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("../repositories/refreshTokenRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return refreshRepoMocks; }),
}));

let app;

beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    const module = await import("../config/app.js");
    app = module.default.app;
});

describe("POST /auth/login", () => {
    it("returns 400 when identifier/password are missing from the body (validated upfront)", async () => {
        const res = await request(app).post("/auth/login").send({});
        expect(res.status).toBe(400);
    });

    it("returns 200 and sets httpOnly cookies when credentials are valid", async () => {
        const hash = await SecurityHelper.createHash("goodpassword");

        userRepoMocks.getUserByIdentifier.mockResolvedValue({
            id: "1",
            email: "adrien@test.fr",
            username: "adrien",
            password: hash,
        });
        refreshRepoMocks.create.mockResolvedValue(true);

        const res = await request(app)
            .post("/auth/login")
            .send({ identifier: "adrien@test.fr", password: "goodpassword" });

        expect(res.status).toBe(200);
        expect(res.headers["set-cookie"].some((c) => c.startsWith("access_token="))).toBe(true);
        // the raw token must not leak into the body for a web client (cookies only)
        expect(res.body.token).toBeUndefined();
    });
});

describe("GET /auth/me", () => {
    it("returns 401 without an access cookie/token", async () => {
        const res = await request(app).get("/auth/me");
        expect(res.status).toBe(401);
    });
});

describe("default 404", () => {
    it("returns 404 on an unknown route", async () => {
        const res = await request(app).get("/unknown-route");
        expect(res.status).toBe(404);
    });
});