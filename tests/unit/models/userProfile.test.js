import { describe, it, expect, beforeAll } from "vitest";
import UserProfile from "../../../models/userProfile.js";

beforeAll(() => {
    process.env.ADMIN_ID = "admin-1";
});

describe("UserProfile", () => {
    it("marks the profile as admin only when it's the current user and matches ADMIN_ID", () => {
        const profile = new UserProfile({ id: "admin-1", username: "adrien" }, true);

        expect(profile.isAdmin).toBe(true);
    });

    it("marks a non-admin current user's profile as not admin", () => {
        const profile = new UserProfile({ id: "user-2", username: "bob" }, true);

        expect(profile.isAdmin).toBe(false);
    });

    it("never includes isAdmin on someone else's profile (current: false)", () => {
        const profile = new UserProfile({ id: "admin-1", username: "adrien" }, false);

        expect(profile.isAdmin).toBeUndefined();
    });
});
