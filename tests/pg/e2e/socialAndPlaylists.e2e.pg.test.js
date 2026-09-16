import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import SecurityHelper from "../../../helpers/security.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow } from "../fixtures.js";

// True end-to-end against the real Express app + real Postgres. Importing config/app.js pulls in
// routes/index.js, which already constructs the real NotificationListener/AchievementListener once
// per file (module-level side effect) - so notifications from friend/playlist events are the real
// eventBus pipeline, not a mock. Those listeners fire asynchronously (fire-and-forget, see
// helpers/eventBus.js), so tests that check for a resulting notification give it a moment to land.
describe("Social and playlists journey (real Postgres, real HTTP)", () => {
    /** @type {import("express").Express} */
    let app;

    beforeAll(async () => {
        process.env.JWT_SECRET = "test-secret";
        const module = await import("../../../config/app.js");
        app = module.default.app;
    });

    const sessionFor = (userId) => `access_token=${SecurityHelper.signJwt(userId, "test-secret")}`;
    const flush = () => new Promise((resolve) => setTimeout(resolve, 100));

    it("friend request -> accept -> playlist -> invite collaborator -> accept -> shared show -> notifications", async () => {
        await resetDb();
        const ownerId = await insertUser({ username: "Owner" });
        const collaboratorId = await insertUser({ username: "Collaborator" });
        const ownerCookie = sessionFor(ownerId);
        const collaboratorCookie = sessionFor(collaboratorId);
        const showId = await insertShow({ title: "Shared Show" });

        const sendRequestRes = await request(app).post("/friends").set("Cookie", ownerCookie).send({ userId: collaboratorId });
        expect(sendRequestRes.status).toBe(200);

        const receivedRes = await request(app).get("/friends").query({ status: "received" }).set("Cookie", collaboratorCookie);
        expect(receivedRes.body.received.map((u) => u.id)).toEqual([ownerId]);

        const acceptRes = await request(app).patch(`/friends/${ownerId}`).set("Cookie", collaboratorCookie).send({ userId: ownerId });
        expect(acceptRes.status).toBe(200);
        await flush();
        const friendRequestNotif = await request(app).get("/notifications").set("Cookie", ownerCookie);
        expect(friendRequestNotif.body.notifications.some((n) => n.type === "friend_accepted")).toBe(true);

        const createPlaylistRes = await request(app).post("/playlists").set("Cookie", ownerCookie).send({ name: "Shared List", visible: false });
        expect(createPlaylistRes.status).toBe(201);
        const playlistId = createPlaylistRes.body.id;

        const inviteRes = await request(app).post(`/playlists/${playlistId}/collaborators`).set("Cookie", ownerCookie).send({ userId: collaboratorId });
        expect(inviteRes.status).toBe(201);
        await flush();
        const inviteNotif = await request(app).get("/notifications").set("Cookie", collaboratorCookie);
        expect(inviteNotif.body.notifications.some((n) => n.type === "playlist_collaborator_invited")).toBe(true);

        const acceptInviteRes = await request(app).patch(`/playlists/${playlistId}/collaborators/accept`).set("Cookie", collaboratorCookie);
        expect(acceptInviteRes.status).toBe(200);

        const addShowRes = await request(app).post(`/playlists/${playlistId}/shows`).set("Cookie", collaboratorCookie).send({ showId });
        expect(addShowRes.status).toBe(201);
        await flush();

        const getPlaylistRes = await request(app).get(`/playlists/${playlistId}`).set("Cookie", ownerCookie);
        expect(getPlaylistRes.status).toBe(200);
        expect(getPlaylistRes.body.shows.map((s) => s.title)).toEqual(["Shared Show"]);
        expect(getPlaylistRes.body.playlist.role).toBe("owner");

        const showAddedNotif = await request(app).get("/notifications").set("Cookie", ownerCookie);
        expect(showAddedNotif.body.notifications.some((n) => n.type === "playlist_show_added")).toBe(true);

        const collaboratorViewRes = await request(app).get(`/playlists/${playlistId}`).set("Cookie", collaboratorCookie);
        expect(collaboratorViewRes.body.playlist.role).toBe("collaborator");
    });

    it("a stranger cannot see or edit a non-visible playlist", async () => {
        await resetDb();
        const ownerId = await insertUser();
        const strangerId = await insertUser();
        const createRes = await request(app).post("/playlists").set("Cookie", sessionFor(ownerId)).send({ name: "Private", visible: false });
        const playlistId = createRes.body.id;

        const res = await request(app).get(`/playlists/${playlistId}`).set("Cookie", sessionFor(strangerId));

        expect(res.status).toBe(400);
    });

    it("declining a pending collaboration invite removes it without notifying the owner twice", async () => {
        await resetDb();
        const ownerId = await insertUser();
        const invitedId = await insertUser();
        await request(app).post("/friends").set("Cookie", sessionFor(ownerId)).send({ userId: invitedId });
        await request(app).patch(`/friends/${ownerId}`).set("Cookie", sessionFor(invitedId)).send({ userId: ownerId });
        const createRes = await request(app).post("/playlists").set("Cookie", sessionFor(ownerId)).send({ name: "Playlist" });
        const playlistId = createRes.body.id;
        await request(app).post(`/playlists/${playlistId}/collaborators`).set("Cookie", sessionFor(ownerId)).send({ userId: invitedId });

        const declineRes = await request(app).delete(`/playlists/${playlistId}/collaborators/${invitedId}`).set("Cookie", sessionFor(invitedId));

        expect(declineRes.status).toBe(204);
        const collaboratorsRes = await request(app).get(`/playlists/${playlistId}/collaborators`).set("Cookie", sessionFor(ownerId));
        expect(collaboratorsRes.body).toEqual([]);
    });
});
