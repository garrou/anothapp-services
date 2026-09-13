import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../helpers/security.js";
import ServiceError from "../helpers/serviceError.js";

const settingServiceMocks = vi.hoisted(() => ({exportData: vi.fn()}));

vi.mock("../services/settingService.js", () => ({
    default: vi.fn().mockImplementation(function () { return settingServiceMocks; }),
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

describe("GET /settings/export-data", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).get("/settings/export-data");
        expect(res.status).toBe(401);
    });

    it("returns the exported data with an attachment content-disposition header", async () => {
        settingServiceMocks.exportData.mockResolvedValue(["user-data-user-1-2024-01-01.json", {user: {id: "user-1"}, shows: []}]);

        const res = await request(app).get("/settings/export-data").set("Cookie", cookie);

        expect(settingServiceMocks.exportData).toHaveBeenCalledWith("user-1");
        expect(res.status).toBe(200);
        expect(res.headers["content-disposition"]).toContain('filename="user-data-user-1-2024-01-01.json"');
        expect(res.body).toEqual({user: {id: "user-1"}, shows: []});
    });

    it("returns 400 when the daily export quota was already used", async () => {
        settingServiceMocks.exportData.mockRejectedValue(new ServiceError(400, "Trop de demandes d'export"));

        const res = await request(app).get("/settings/export-data").set("Cookie", cookie);

        expect(res.status).toBe(400);
    });
});
