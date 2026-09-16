import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import UserRepository from "../../../repositories/userRepository.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

// Both cancelDeletion and anonymizeEligibleAccounts are single UPDATE statements whose WHERE
// clause re-checks the account's current state (email not already anonymized / deleted_at still
// set), so unlike the check-then-act races elsewhere in this folder, Postgres's own row-level
// locking under READ COMMITTED already serializes and re-evaluates them correctly - this is
// positive coverage proving that holds, not a bug regression test.
describe("Account deletion cancellation vs. scheduled anonymization (real Postgres)", () => {
    /** @type {UserRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new UserRepository();
    });

    it("never leaves the account both cancelled and anonymized when racing past the grace period", async () => {
        for (let i = 0; i < 10; i++) {
            await resetDb();
            const userId = await insertUser({ email: `racer-${i}@test.fr` });
            await repo.requestDeletion(userId);
            await db.query(`UPDATE users SET deleted_at = NOW() - INTERVAL '31 days' WHERE id = $1`, [userId]);

            await Promise.allSettled([
                repo.cancelDeletion(userId),
                repo.anonymizeEligibleAccounts(30),
            ]);

            const user = await repo.getUserById(userId);
            const wasCancelled = user.deletedAt === null;
            const wasAnonymized = user.email.startsWith("deleted-");
            expect(wasCancelled && wasAnonymized).toBe(false);
            expect(wasCancelled || wasAnonymized).toBe(true);
        }
    });
});
