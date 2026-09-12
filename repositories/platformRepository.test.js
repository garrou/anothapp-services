import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import PlatformRepository from "./platformRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("PlatformRepository.getPlatforms", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new PlatformRepository();
    });

    it("maps rows (pid -> id) to Platform instances", async () => {
        db.query.mockResolvedValue({rows: [{pid: 1, name: "Netflix", logo: "netflix.png"}]});

        const result = await repo.getPlatforms();

        expect(result).toEqual([{id: 1, name: "Netflix", logo: "netflix.png"}]);
    });
});

describe("PlatformRepository.upsertPlatform", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new PlatformRepository();
    });

    it("returns true when a row was inserted or updated", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.upsertPlatform(1, "Netflix", "netflix.png");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO platforms"), [1, "Netflix", "netflix.png"]);
        expect(result).toBe(true);
    });

    it("returns false when nothing was written", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.upsertPlatform(1, "Netflix", "netflix.png");

        expect(result).toBe(false);
    });
});
