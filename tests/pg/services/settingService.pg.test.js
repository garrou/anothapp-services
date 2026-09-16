import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import SettingService from "../../../services/settingService.js";
import { resetDb } from "../resetDb.js";
import {
    insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason, insertEpisode, insertUserEpisode,
    insertActor, insertPlaylist,
} from "../fixtures.js";

describe("SettingService (real Postgres)", () => {
    /** @type {SettingService} */
    let service;

    beforeEach(async () => {
        await resetDb();
        service = new SettingService();
    });

    describe("exportData", () => {
        it("assembles the full export: show/season/episode tree, friends, playlists, favorites, platforms, achievements", async () => {
            const userId = await insertUser({ username: "Exporter" });
            const showId = await insertShow({ title: "Exported Show", duration: 30 });
            await insertSeason(showId, 1, { episodes: 5 });
            await insertUserShow(userId, showId, { favorite: true });
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1, { title: "Pilot" });
            await insertUserEpisode(userId, userSeasonId, episodeId);

            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);

            const playlistId = await insertPlaylist(userId, { name: "My Playlist" });
            await db.query(`INSERT INTO playlists_shows (playlist_id, show_id) VALUES ($1, $2)`, [playlistId, showId]);

            const actorId = await insertActor();
            await db.query(`INSERT INTO users_favorite_actors (user_id, actor_id) VALUES ($1, $2)`, [userId, actorId]);
            await db.query(`INSERT INTO users_platforms (user_id, platform_id) VALUES ($1, 1)`, [userId]);

            const [filename, data] = await service.exportData(userId);

            expect(filename).toContain(userId);
            expect(data.user.username).toBe("Exporter");
            expect(data.shows).toHaveLength(1);
            expect(data.shows[0].title).toBe("Exported Show");
            expect(data.shows[0].seasons).toHaveLength(1);
            expect(data.shows[0].seasons[0].episodes.map((e) => e.title)).toEqual(["Pilot"]);
            expect(data.friends).toHaveLength(1);
            expect(data.playlists).toHaveLength(1);
            expect(data.playlists[0].shows.map((s) => s.title)).toEqual(["Exported Show"]);
            expect(data.favoriteActors).toHaveLength(1);
            expect(data.platforms).toEqual([1]);
            expect(data.achievements.length).toBeGreaterThan(0);
        });

        it("rejects a second export within the same day", async () => {
            const userId = await insertUser();
            await service.exportData(userId);

            await expect(service.exportData(userId)).rejects.toMatchObject({ status: 400 });
        });
    });
});
