import { describe, it, expect, afterEach } from "vitest";
import db from "../config/db.js";
import PlatformRepository from "./platformRepository.js";

describe("PlatformRepository (real Postgres)", () => {
    const repo = new PlatformRepository();

    afterEach(async () => {
        await db.query(`DELETE FROM platforms WHERE id >= 90000`);
    });

    describe("getPlatforms", () => {
        it("includes every seeded platform, ordered by name", async () => {
            const result = await repo.getPlatforms();

            expect(result).toContainEqual({ id: 1, name: "Netflix", logo: "https://pictures.betaseries.com/platforms/1.jpg" });
            expect(result).toContainEqual({ id: 999, name: "Autres", logo: "" });
            const netflixIndex = result.findIndex((p) => p.name === "Netflix");
            const ocsIndex = result.findIndex((p) => p.name === "OCS");
            expect(netflixIndex).toBeLessThan(ocsIndex);
        });
    });

    describe("upsertPlatform", () => {
        it("inserts a new platform", async () => {
            const result = await repo.upsertPlatform(90001, "TestPlatform", "logo.jpg");

            expect(result).toBe(true);
            const platforms = await repo.getPlatforms();
            expect(platforms).toContainEqual({ id: 90001, name: "TestPlatform", logo: "logo.jpg" });
        });

        it("updates name/logo of an existing platform on conflict", async () => {
            await repo.upsertPlatform(90002, "Original", "original.jpg");

            const result = await repo.upsertPlatform(90002, "Renamed", "renamed.jpg");

            expect(result).toBe(true);
            const platforms = await repo.getPlatforms();
            expect(platforms).toContainEqual({ id: 90002, name: "Renamed", logo: "renamed.jpg" });
            expect(platforms.filter((p) => p.id === 90002)).toHaveLength(1);
        });
    });
});
