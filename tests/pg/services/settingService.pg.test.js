import { describe, it, expect, beforeEach, vi } from "vitest";
import db from "../../../config/db.js";
import SettingService from "../../../services/settingService.js";
import { resetDb } from "../resetDb.js";
import {
    insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason, insertEpisode, insertUserEpisode,
    insertActor, insertPlaylist,
} from "../fixtures.js";

// These tests hand-build import payloads without a signature - what's under test here is the
// import/DB logic (FK handling, catalog isolation, dedup...), not the signature mechanism, which
// already has its own coverage (tests/unit/helpers/security.test.js) and is exercised for real,
// end-to-end, in tests/pg/e2e/exportImport.e2e.pg.test.js.
vi.mock("../../../helpers/security.js", async (importOriginal) => {
    const actual = await importOriginal();
    return { default: { ...actual.default, verifyExportSignature: () => true } };
});

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
            // The exported user's id/email are never read back on import - only req.userId (the
            // destination account) ever is - but they're harmless to include, and email in
            // particular is part of "my own data" for RGPD access (see models/exportData.js).
            expect(data.user.id).toBe(userId);
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

        it("links a show/season/episode already in the shared catalog to the user's collection", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ title: "Catalog Show" });
            await insertSeason(showId, 1, { episodes: 5, image: "s1.jpg" });
            const episodeId = await insertEpisode(showId, 1, { title: "Pilot" });
            const payload = {
                shows: [{
                    id: showId, title: "Catalog Show", isFavorite: true, isWatching: false, note: 4,
                    addedAt: "2024-01-01T00:00:00.000Z",
                    seasons: [{
                        number: 1, platformId: 999, addedAt: "2024-01-02T00:00:00.000Z",
                        episodes: [{ episodeId, number: 1, title: "Pilot", watchedAt: "2024-01-03T00:00:00.000Z" }],
                    }],
                }],
            };

            const summary = await service.importData(userId, payload);

            expect(summary.shows).toEqual({ imported: 1, errors: 0 });

            const userShow = await db.query(`SELECT * FROM users_shows WHERE user_id = $1 AND show_id = $2`, [userId, showId]);
            expect(userShow.rows[0].favorite).toBe(true);
            expect(userShow.rows[0].continue).toBe(false);
            expect(userShow.rows[0].note_id).toBe(4);

            const userSeason = await db.query(`SELECT * FROM users_seasons WHERE user_id = $1 AND show_id = $2`, [userId, showId]);
            expect(userSeason.rows).toHaveLength(1);

            const userEpisode = await db.query(`
                SELECT ue.* FROM users_episodes ue
                JOIN users_seasons us ON us.id = ue.users_seasons_id
                WHERE us.user_id = $1 AND us.show_id = $2
            `, [userId, showId]);
            expect(userEpisode.rows).toHaveLength(1);
        });

        it("never writes to the shared catalog - the show/season/episode rows are left untouched", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ title: "Catalog Show", poster: "original.jpg", duration: 30 });
            await insertSeason(showId, 1, { episodes: 5, image: "original.jpg" });
            const payload = {
                shows: [{
                    // Deliberately mismatched fields, mirroring a stale or hand-edited export -
                    // none of this should ever reach the shows/seasons rows.
                    id: showId, title: "Tampered Title", poster: "tampered.jpg", description: "tampered",
                    seasons: [{ number: 1, image: "tampered.jpg", episodesCount: 999 }],
                }],
            };

            await service.importData(userId, payload);

            const show = await db.query(`SELECT title, poster, duration FROM shows WHERE id = $1`, [showId]);
            expect(show.rows[0].title).toBe("Catalog Show");
            expect(show.rows[0].poster).toBe("original.jpg");
            expect(show.rows[0].duration).toBe(30);

            const season = await db.query(`SELECT image, episodes FROM seasons WHERE show_id = $1 AND number = 1`, [showId]);
            expect(season.rows[0].image).toBe("original.jpg");
            expect(season.rows[0].episodes).toBe(5);
        });

        it("reports a per-show error instead of fabricating a show missing from the shared catalog", async () => {
            const userId = await insertUser();

            const summary = await service.importData(userId, {
                shows: [{ id: 999999, title: "Unknown show", seasons: [] }],
            });

            expect(summary.shows).toEqual({ imported: 0, errors: 1 });
            expect(summary.errors[0]).toContain("Unknown show");
            const show = await db.query(`SELECT * FROM shows WHERE id = 999999`);
            expect(show.rows).toHaveLength(0);
        });

        it("reports a per-show error instead of creating a garbage users_seasons row for a season missing its number", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ title: "Catalog Show" });
            await insertSeason(showId, 1, { episodes: 5 });

            const summary = await service.importData(userId, {
                shows: [{
                    id: showId, title: "Catalog Show",
                    seasons: [{ addedAt: "2024-01-01T00:00:00.000Z", episodes: [] }],
                }],
            });

            expect(summary.shows).toEqual({ imported: 0, errors: 1 });
            expect(summary.errors[0]).toContain("Saison invalide");
            const userSeason = await db.query(
                `SELECT * FROM users_seasons WHERE user_id = $1 AND show_id = $2`, [userId, showId]
            );
            expect(userSeason.rows).toHaveLength(0);
        });

        it("does not duplicate a viewing already imported on a second run", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ title: "Rewatch Show" });
            await insertSeason(showId, 1);
            const payload = {
                shows: [{
                    id: showId, title: "Rewatch Show", isWatching: true, addedAt: "2024-01-01T00:00:00.000Z",
                    seasons: [{ number: 1, platformId: 999, addedAt: "2024-01-02T00:00:00.000Z", episodes: [] }],
                }],
            };

            await service.importData(userId, payload);
            await service.importData(userId, payload);

            const seasons = await db.query(`SELECT * FROM users_seasons WHERE user_id = $1 AND show_id = $2`, [userId, showId]);
            expect(seasons.rows).toHaveLength(1);
        });

        it("recreates an owned playlist and its shows, but skips a playlist the export user only collaborated on", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ title: "Playlist Show" });
            const payload = {
                shows: [],
                playlists: [
                    { name: "My playlist", role: "owner", visible: true, shows: [{ id: showId, title: "Playlist Show" }] },
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

        it("reports a per-playlist error instead of fabricating a show missing from the shared catalog", async () => {
            const userId = await insertUser();

            const summary = await service.importData(userId, {
                shows: [],
                playlists: [{ name: "My playlist", role: "owner", shows: [{ id: 999999, title: "Unknown show" }] }],
            });

            expect(summary.playlists).toEqual({ imported: 0, errors: 1 });
        });

        it("does not duplicate a playlist already imported on a second run", async () => {
            const userId = await insertUser();
            const payload = {
                shows: [],
                playlists: [{ name: "My playlist", role: "owner", visible: false, shows: [] }],
            };

            await service.importData(userId, payload);
            await service.importData(userId, payload);

            const playlists = await db.query(`SELECT * FROM playlists WHERE user_id = $1 AND name = 'My playlist'`, [userId]);
            expect(playlists.rows).toHaveLength(1);
        });

        it("recreates a favorite actor and a platform, then recomputes achievements", async () => {
            const userId = await insertUser();
            const actorId = await insertActor({ name: "Catalog Actor" });
            const payload = {
                shows: [],
                favoriteActors: [{ id: actorId, name: "Catalog Actor" }],
                platforms: [1],
            };

            const summary = await service.importData(userId, payload);

            expect(summary.favoriteActors).toEqual({ imported: 1, errors: 0 });
            expect(summary.platforms).toEqual({ imported: 1, errors: 0 });

            const favorite = await db.query(`SELECT * FROM users_favorite_actors WHERE user_id = $1 AND actor_id = $2`, [userId, actorId]);
            expect(favorite.rows).toHaveLength(1);

            const platform = await db.query(`SELECT * FROM users_platforms WHERE user_id = $1 AND platform_id = 1`, [userId]);
            expect(platform.rows).toHaveLength(1);
        });

        it("restores the exported episode-tracking preference, backfilling episode history for already-imported shows", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: false });
            const showId = await insertShow({ title: "Tracked Show" });
            await insertSeason(showId, 1, { episodes: 1 });
            await insertEpisode(showId, 1, { number: 1, date: "2020-01-01" });
            const payload = {
                shows: [{
                    id: showId, title: "Tracked Show", addedAt: "2024-01-01T00:00:00.000Z",
                    seasons: [{ number: 1, platformId: 999, addedAt: "2024-01-02T00:00:00.000Z", episodes: [] }],
                }],
                user: { episodeTrackingEnabled: true },
            };

            await service.importData(userId, payload);

            const user = await db.query(`SELECT episode_tracking_enabled FROM users WHERE id = $1`, [userId]);
            expect(user.rows[0].episode_tracking_enabled).toBe(true);

            const userEpisodes = await db.query(`
                SELECT ue.* FROM users_episodes ue
                JOIN users_seasons us ON us.id = ue.users_seasons_id
                WHERE us.user_id = $1 AND us.show_id = $2
            `, [userId, showId]);
            expect(userEpisodes.rows).toHaveLength(1);
        });

        it("does not touch episode tracking when the export carries no such preference", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: false });

            await service.importData(userId, { shows: [] });

            const user = await db.query(`SELECT episode_tracking_enabled FROM users WHERE id = $1`, [userId]);
            expect(user.rows[0].episode_tracking_enabled).toBe(false);
        });

        it("reports a per-actor error instead of fabricating an actor missing from the shared catalog", async () => {
            const userId = await insertUser();

            const summary = await service.importData(userId, {
                shows: [], favoriteActors: [{ id: 999999, name: "Unknown actor" }],
            });

            expect(summary.favoriteActors).toEqual({ imported: 0, errors: 1 });
            expect(summary.errors[0]).toContain("Unknown actor");
        });

        it("keeps going and reports a per-show error instead of failing the whole import", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ title: "Good show" });
            const payload = {
                shows: [
                    { id: showId, title: "Good show", seasons: [] },
                    { id: 999999, title: "Unknown show", seasons: [] },
                ],
            };

            const summary = await service.importData(userId, payload);

            expect(summary.shows.imported).toBe(1);
            expect(summary.shows.errors).toBe(1);
            expect(summary.errors[0]).toContain("Unknown show");
        });
    });
});
