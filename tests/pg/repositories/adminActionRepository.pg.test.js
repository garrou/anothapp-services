import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import AdminActionRepository from "../../../repositories/adminActionRepository.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

describe("AdminActionRepository (real Postgres)", () => {
    /** @type {AdminActionRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new AdminActionRepository();
    });

    describe("create / getRecent", () => {
        it("logs an action against a target user and lists it back", async () => {
            const adminId = await insertUser({ username: "Admin" });
            const targetId = await insertUser({ username: "Target" });

            const id = await repo.create(adminId, "revoke_sessions", targetId);

            expect(id).toEqual(expect.any(String));
            const recent = await repo.getRecent();
            expect(recent).toHaveLength(1);
            expect(recent[0]).toMatchObject({ id, adminUserId: adminId, action: "revoke_sessions", targetUserId: targetId });
        });

        it("allows a null target for account-wide actions", async () => {
            const adminId = await insertUser({ username: "Admin" });

            await repo.create(adminId, "some_action");

            const recent = await repo.getRecent();
            expect(recent[0].targetUserId).toBeNull();
        });

        it("returns the most recent actions first, bounded by the limit", async () => {
            const adminId = await insertUser({ username: "Admin" });
            await repo.create(adminId, "action_1");
            await new Promise((resolve) => setTimeout(resolve, 10));
            await repo.create(adminId, "action_2");

            const recent = await repo.getRecent(1);

            expect(recent).toHaveLength(1);
            expect(recent[0].action).toBe("action_2");
        });

        it("keeps the log entry (with a null target) once the target account's row is gone", async () => {
            // target_user_id is ON DELETE SET NULL - the audit trail survives even if the
            // referenced account row is later removed, unlike admin_user_id (ON DELETE CASCADE)
            const adminId = await insertUser({ username: "Admin" });
            const targetId = await insertUser({ username: "Target" });
            await repo.create(adminId, "revoke_sessions", targetId);

            await db.query(`DELETE FROM users WHERE id = $1`, [targetId]);

            const recent = await repo.getRecent();
            expect(recent).toHaveLength(1);
            expect(recent[0].targetUserId).toBeNull();
        });
    });
});
