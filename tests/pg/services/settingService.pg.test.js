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
            const userId = await insertUser({ username: "Exporter", email: "exporter@test.fr" });
            const showId = await insertShow({ title: "Exported Show", duration: 30 });
            await insertSeason(showId, 1, { episodes: 5, image: "s1.jpg" });
            await insertUserShow(userId, showId, { favorite: true });
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1, { title: "Pilot", length: 45, description: "desc" });
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
            // The exported user is self-sufficient for RGPD access but never usable to overwrite
            // the target account on import: id must be gone, email stays (see models/exportData.js).
            expect(data.user.id).toBeUndefined();
            expect(data.user.email).toBe("exporter@test.fr");
            expect(data.shows).toHaveLength(1);
            expect(data.shows[0].title).toBe("Exported Show");
            // Enough of the show/season/episode's own catalog data to recreate them without
            // calling Betaseries on a re-import.
            expect(data.shows[0].poster).toBeDefined();
            expect(data.shows[0].seasons).toHaveLength(1);
            expect(data.shows[0].seasons[0].image).toBe("s1.jpg");
            expect(data.shows[0].seasons[0].episodesCount).toBe(5);
            expect(data.shows[0].seasons[0].episodes.map((e) => e.title)).toEqual(["Pilot"]);
            expect(data.shows[0].seasons[0].episodes[0].length).toBe(45);
            expect(data.shows[0].seasons[0].episodes[0].description).toBe("desc");
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

    describe("importData", () => {
        it("rejects a payload without a shows array", async () => {
            const userId = await insertUser();

            await expect(service.importData(userId, {})).rejects.toMatchObject({ status: 400 });
        });

        it("recreates a show/season/episode tree from an export, without needing it to exist locally first", async () => {
            const userId = await insertUser();
            const payload = {
                shows: [{
                    id: 900, title: "Imported Show", kinds: ["Drame"], country: "FR", seasonsNumber: 1,
                    episodeDuration: 40, isFavorite: true, isWatching: false, note: 4, addedAt: "2024-01-01T00:00:00.000Z",
                    poster: "poster.jpg", description: "desc", creation: 2020, network: "TF1", language: "fr",
                    totalEpisodes: 5, finished: false,
                    seasons: [{
                        number: 1, platformId: 999, addedAt: "2024-01-02T00:00:00.000Z", image: "s1.jpg", episodesCount: 5,
                        episodes: [{
                            episodeId: 9001, number: 1, title: "Pilot", code: "S01E01", global: 1, length: 40,
                            date: "2020-01-01", description: "ep desc", watchedAt: "2024-01-03T00:00:00.000Z",
                        }],
                    }],
                }],
            };

            const summary = await service.importData(userId, payload);

            expect(summary.shows).toEqual({ imported: 1, errors: 0 });

            const show = await db.query(`SELECT * FROM shows WHERE id = 900`);
            expect(show.rows[0].title).toBe("Imported Show");
            expect(show.rows[0].poster).toBe("poster.jpg");

            const kinds = await db.query(`
                SELECT k.name FROM shows_kinds sk JOIN kinds k ON k.id = sk.kind_id WHERE sk.show_id = 900
            `);
            expect(kinds.rows.map((r) => r.name)).toEqual(["Drame"]);

            const userShow = await db.query(`SELECT * FROM users_shows WHERE user_id = $1 AND show_id = 900`, [userId]);
            expect(userShow.rows[0].favorite).toBe(true);
            expect(userShow.rows[0].continue).toBe(false);
            expect(userShow.rows[0].note_id).toBe(4);

            const season = await db.query(`SELECT * FROM seasons WHERE show_id = 900 AND number = 1`);
            expect(season.rows[0].image).toBe("s1.jpg");
            expect(season.rows[0].episodes).toBe(5);

            const episode = await db.query(`SELECT * FROM episodes WHERE id = 9001`);
            expect(episode.rows[0].title).toBe("Pilot");

            const userEpisode = await db.query(`
                SELECT ue.* FROM users_episodes ue
                JOIN users_seasons us ON us.id = ue.users_seasons_id
                WHERE us.user_id = $1 AND us.show_id = 900
            `, [userId]);
            expect(userEpisode.rows).toHaveLength(1);
        });

        it("does not duplicate a viewing already imported on a second run", async () => {
            const userId = await insertUser();
            const payload = {
                shows: [{
                    id: 901, title: "Rewatch Show", kinds: [], country: "FR", seasonsNumber: 1, episodeDuration: 30,
                    isFavorite: false, isWatching: true, note: null, addedAt: "2024-01-01T00:00:00.000Z",
                    poster: null, description: null, creation: null, network: null, language: null,
                    totalEpisodes: 1, finished: false,
                    seasons: [{ number: 1, platformId: 999, addedAt: "2024-01-02T00:00:00.000Z", image: null, episodesCount: 1, episodes: [] }],
                }],
            };

            await service.importData(userId, payload);
            await service.importData(userId, payload);

            const seasons = await db.query(`SELECT * FROM users_seasons WHERE user_id = $1 AND show_id = 901`, [userId]);
            expect(seasons.rows).toHaveLength(1);
        });

        it("recreates an owned playlist and its shows, but skips a playlist the export user only collaborated on", async () => {
            const userId = await insertUser();
            const payload = {
                shows: [],
                playlists: [
                    {
                        name: "My playlist", role: "owner", visible: true,
                        shows: [{ id: 902, title: "Playlist Show", kinds: [], country: "FR", seasonsNumber: 1, episodeDuration: 30 }],
                    },
                    { name: "Shared playlist", role: "collaborator", shows: [] },
                ],
            };

            const summary = await service.importData(userId, payload);

            expect(summary.playlists).toEqual({ imported: 2, errors: 0 });

            const playlists = await db.query(`SELECT * FROM playlists WHERE user_id = $1`, [userId]);
            expect(playlists.rows.map((r) => r.name)).toEqual(["My playlist"]);

            const shows = await db.query(`
                SELECT s.title FROM playlists_shows ps JOIN shows s ON s.id = ps.show_id
                JOIN playlists p ON p.id = ps.playlist_id WHERE p.user_id = $1
            `, [userId]);
            expect(shows.rows.map((r) => r.title)).toEqual(["Playlist Show"]);
        });

        it("recreates a favorite actor and a platform, then recomputes achievements", async () => {
            const userId = await insertUser();
            const payload = {
                shows: [],
                favoriteActors: [{ id: 903, name: "Imported Actor", picture: null, birthday: null, deathday: null, nationality: null, description: null }],
                platforms: [1],
            };

            const summary = await service.importData(userId, payload);

            expect(summary.favoriteActors).toEqual({ imported: 1, errors: 0 });
            expect(summary.platforms).toEqual({ imported: 1, errors: 0 });

            const actor = await db.query(`SELECT * FROM actors WHERE id = 903`);
            expect(actor.rows[0].name).toBe("Imported Actor");

            const favorite = await db.query(`SELECT * FROM users_favorite_actors WHERE user_id = $1 AND actor_id = 903`, [userId]);
            expect(favorite.rows).toHaveLength(1);

            const platform = await db.query(`SELECT * FROM users_platforms WHERE user_id = $1 AND platform_id = 1`, [userId]);
            expect(platform.rows).toHaveLength(1);
        });

        it("keeps going and reports a per-show error instead of failing the whole import", async () => {
            const userId = await insertUser();
            const payload = {
                shows: [
                    { id: 904, title: "Good show", kinds: [], country: "FR", seasonsNumber: 1, episodeDuration: 30, seasons: [] },
                    // Missing the required fields createShow needs (duration NOT NULL) - triggers a per-show failure.
                    { id: 905, title: "Broken show", seasons: [] },
                ],
            };

            const summary = await service.importData(userId, payload);

            expect(summary.shows.imported).toBe(1);
            expect(summary.shows.errors).toBe(1);
            expect(summary.errors[0]).toContain("Broken show");
        });
    });
});
