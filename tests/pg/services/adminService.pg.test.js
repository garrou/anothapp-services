import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import AdminService from "../../../services/adminService.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

describe("AdminService (real Postgres)", () => {
    /** @type {AdminService} */
    let service;

    beforeEach(async () => {
        await resetDb();
        service = new AdminService();
    });

    describe("getDashboard", () => {
        it("aggregates real data from every table into the grouped shape", async () => {
            const userId = await insertUser();
            await db.query(`
                INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, 'h1', NOW() + INTERVAL '1 day')
            `, [userId]);

            const dashboard = await service.getDashboard();

            expect(dashboard.users.total).toBe(1);
            expect(dashboard.users.newByDay).toHaveLength(1);
            expect(dashboard.sessions.active).toBe(1);
            expect(dashboard.database.size).toEqual(expect.any(String));
            expect(dashboard.recentActions).toEqual([]);
            expect(dashboard.health).toHaveProperty("betaseries");
            expect(dashboard.health).toHaveProperty("mailer");
        });
    });

    describe("searchUsers", () => {
        it("finds a real account by username or email", async () => {
            const userId = await insertUser({ username: "FindMe", email: "findme@test.fr" });

            const result = await service.searchUsers("findme");

            expect(result).toEqual([{ id: userId, username: "FindMe", email: "findme@test.fr" }]);
        });
    });

    describe("revokeUserSessions", () => {
        it("revokes the target's sessions and logs the action, both committed together", async () => {
            const adminId = await insertUser({ username: "Admin" });
            const targetId = await insertUser({ username: "Target" });
            await db.query(`
                INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, 'h1', NOW() + INTERVAL '1 day')
            `, [targetId]);

            const result = await service.revokeUserSessions(adminId, targetId);

            expect(result).toEqual({ revokedCount: 1 });
            const tokens = await db.query(`SELECT revoked_at FROM refresh_tokens WHERE user_id = $1`, [targetId]);
            expect(tokens.rows[0]["revoked_at"]).not.toBeNull();
            const actions = await db.query(`SELECT * FROM admin_actions WHERE admin_user_id = $1`, [adminId]);
            expect(actions.rows).toHaveLength(1);
            expect(actions.rows[0]["target_user_id"]).toBe(targetId);
        });

        it("rolls back the session revocation when logging the action fails, since both happen in the same transaction", async () => {
            const targetId = await insertUser({ username: "Target" });
            await db.query(`
                INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, 'h1', NOW() + INTERVAL '1 day')
            `, [targetId]);
            // an admin id with no matching users row - the admin_actions FK makes the log insert fail
            const bogusAdminId = "00000000-0000-0000-0000-000000000000";

            await expect(service.revokeUserSessions(bogusAdminId, targetId)).rejects.toThrow();

            const tokens = await db.query(`SELECT revoked_at FROM refresh_tokens WHERE user_id = $1`, [targetId]);
            expect(tokens.rows[0]["revoked_at"]).toBeNull();
            const actions = await db.query(`SELECT * FROM admin_actions WHERE target_user_id = $1`, [targetId]);
            expect(actions.rows).toHaveLength(0);
        });
    });
});
