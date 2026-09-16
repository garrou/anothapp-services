import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import ShowRepository from "../../../repositories/showRepository.js";
import { resetDb } from "../resetDb.js";

// #syncKinds sorts newly-introduced kinds by id before inserting them, specifically so two shows
// created at the same time that both introduce the same brand-new genres always lock those rows
// in the same order - otherwise two shows whose genre lists come back in different orders (real
// possibility: each show's own object key order isn't guaranteed consistent) could deadlock
// against each other. This exercises genuine concurrent transactions (unlike the check-then-act
// races in friendRequestRace/refreshTokenRace, a deadlock is a real multi-connection phenomenon
// that Promise.all across the pool actually reproduces) with the two shows introducing the same
// two new kinds in opposite order, repeated to make a lock-order bug show up reliably if reintroduced.
describe("Concurrent show creation introducing shared new kinds (real Postgres)", () => {
    /** @type {ShowRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new ShowRepository();
    });

    it("never deadlocks across repeated concurrent runs", async () => {
        for (let i = 0; i < 15; i++) {
            await resetDb();

            const results = await Promise.allSettled([
                repo.createShow(1, "Show A", null, [
                    { id: "NewKindA", name: "Fresh Genre" }, { id: "NewKindB", name: "Other Genre" },
                ], 30, 1, "FR", null, null, null, null, null),
                repo.createShow(2, "Show B", null, [
                    { id: "NewKindB", name: "Other Genre" }, { id: "NewKindA", name: "Fresh Genre" },
                ], 30, 1, "FR", null, null, null, null, null),
            ]);

            expect(results.every((r) => r.status === "fulfilled")).toBe(true);
        }

        const shows = await db.query(`SELECT COUNT(*) AS total FROM shows_kinds`);
        expect(parseInt(shows.rows[0].total)).toBe(4);
    });
});
