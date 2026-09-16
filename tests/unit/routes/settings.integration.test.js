import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../../../helpers/security.js";
import ServiceError from "../../../helpers/serviceError.js";

const settingServiceMocks = vi.hoisted(() => ({exportData: vi.fn(), importData: vi.fn()}));

vi.mock("../../../services/settingService.js", () => ({
    default: vi.fn().mockImplementation(function () { return settingServiceMocks; }),
}));

let app;
let cookie;

beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    // #setupCors reads process.env.ORIGIN once, at module load - has to be set before the
    // dynamic import below, same reason JWT_SECRET is set here rather than in a per-test hook.
    process.env.ORIGIN = "http://localhost:5173";
    const module = await import("../../../config/app.js");
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

    it("exposes Content-Disposition cross-origin, so the frontend can read the real filename", async () => {
        settingServiceMocks.exportData.mockResolvedValue(["user-data-user-1-2024-01-01.json", {}]);

        const res = await request(app).get("/settings/export-data")
            .set("Cookie", cookie).set("Origin", "http://localhost:5173");

        expect(res.headers["access-control-expose-headers"]).toContain("Content-Disposition");
    });
});

describe("POST /settings/import-data", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).post("/settings/import-data").send({shows: []});
        expect(res.status).toBe(401);
    });

    it("passes the authenticated user id and the body to the service, returning its summary", async () => {
        const payload = {shows: [{id: 10, title: "Show"}]};
        settingServiceMocks.importData.mockResolvedValue({shows: {imported: 1, errors: 0}});

        const res = await request(app).post("/settings/import-data").set("Cookie", cookie).send(payload);

        expect(settingServiceMocks.importData).toHaveBeenCalledWith("user-1", payload);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({shows: {imported: 1, errors: 0}});
    });

    it("returns 400 for an invalid payload", async () => {
        settingServiceMocks.importData.mockRejectedValue(new ServiceError(400, "Requête invalide"));

        const res = await request(app).post("/settings/import-data").set("Cookie", cookie).send({});

        expect(res.status).toBe(400);
    });
});
