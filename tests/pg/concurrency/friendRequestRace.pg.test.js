import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import FriendRepository from "../../../repositories/friendRepository.js";
import FriendService from "../../../services/friendService.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

// fst_user_id/sec_user_id encode direction (who sent the request), so the composite primary key
// alone doesn't stop two users sending each other a request at almost the same moment: A->B and
// B->A are different keys, so naive check-then-insert code lets both rows commit. Plain
// `Promise.all` rarely opens this window in practice (each call's own check+insert round trip
// tends to finish before the other call even starts its check), so these tests force the exact
// interleaving instead of hoping for a lucky race - proving the fix (a unique index on the
// unordered pair, see migrations/init.sql) actually holds under the worst-case timing, not just
// the common one.
describe("Mutual friend request race (real Postgres, forced concurrency)", () => {
    /** @type {FriendRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new FriendRepository();
    });

    it("only lets one of two simultaneous mutual requests survive at the repository level", async () => {
        const a = await insertUser();
        const b = await insertUser();
        // Force the precondition a real race produces: both "does this exist" checks return
        // false before either INSERT fires.
        expect(await repo.checkIfRelationExists(a, b)).toBe(false);
        expect(await repo.checkIfRelationExists(b, a)).toBe(false);

        const results = await Promise.allSettled([
            repo.sendFriendRequest(a, b),
            repo.sendFriendRequest(b, a),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        const rejected = results.find((r) => r.status === "rejected");
        expect(rejected.reason.code).toBe("23505");
        const rows = await db.query(`SELECT * FROM friends`);
        expect(rows.rowCount).toBe(1);
    });

    it("the service layer converts the losing side into a clean 409, not a raw DB error", async () => {
        const a = await insertUser();
        const b = await insertUser();
        const serviceA = new FriendService();
        const serviceB = new FriendService();
        const originalCheck = serviceB._friendRepository.checkIfRelationExists;
        // Delay only B's request after its own "does this exist" check resolves (still false,
        // matching a genuine race) but before it acts on that answer - guaranteeing A's request
        // fully lands first, so B's insert hits the unique index instead of both landing clean.
        serviceB._friendRepository.checkIfRelationExists = async (...args) => {
            const result = await originalCheck.apply(serviceB._friendRepository, args);
            await new Promise((resolve) => setTimeout(resolve, 50));
            return result;
        };

        const results = await Promise.allSettled([
            serviceA.sendFriendRequest(a, b),
            serviceB.sendFriendRequest(b, a),
        ]);

        expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
        expect(results[1].reason).toMatchObject({ status: 409 });
        const rows = await db.query(`SELECT * FROM friends`);
        expect(rows.rowCount).toBe(1);
    });
});
