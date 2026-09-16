import { describe, it, expect, afterEach } from "vitest";
import db from "../../../config/db.js";
import KindRepository from "../../../repositories/kindRepository.js";

describe("KindRepository (real Postgres)", () => {
    const repo = new KindRepository();

    afterEach(async () => {
        await db.query(`DELETE FROM kinds WHERE id LIKE 'Test_%'`);
    });

    describe("getKinds", () => {
        it("includes every seeded kind, ordered by name", async () => {
            const result = await repo.getKinds();

            expect(result).toContainEqual({ value: "Comedy", name: "Comédie" });
            expect(result).toContainEqual({ value: "Drama", name: "Drame" });
            const actionIndex = result.findIndex((k) => k.name === "Action");
            const westernIndex = result.findIndex((k) => k.name === "Western");
            expect(actionIndex).toBeLessThan(westernIndex);
        });
    });

    describe("upsertKind", () => {
        it("inserts a new kind", async () => {
            const result = await repo.upsertKind("Test_New", "Nouveau");

            expect(result).toBe(true);
            const kinds = await repo.getKinds();
            expect(kinds).toContainEqual({ value: "Test_New", name: "Nouveau" });
        });

        it("updates the name of an existing kind on conflict", async () => {
            await repo.upsertKind("Test_Existing", "Original");

            const result = await repo.upsertKind("Test_Existing", "Renommé");

            expect(result).toBe(true);
            const kinds = await repo.getKinds();
            expect(kinds).toContainEqual({ value: "Test_Existing", name: "Renommé" });
            expect(kinds.filter((k) => k.value === "Test_Existing")).toHaveLength(1);
        });
    });
});
