import { describe, it, expect } from "vitest";
import Validator from "../../../helpers/validator.js";

describe("Validator.isValidUsername", () => {
    it("rejects a username that is too short", () => {
        expect(Validator.isValidUsername("ab").status).toBe(false);
    });

    it("rejects a username that is too long", () => {
        expect(Validator.isValidUsername("a".repeat(26)).status).toBe(false);
    });

    it("rejects a non-string value", () => {
        expect(Validator.isValidUsername(undefined).status).toBe(false);
    });

    it("accepts a valid username", () => {
        expect(Validator.isValidUsername("adrien").status).toBe(true);
    });
});

describe("Validator.isValidEmail", () => {
    it("rejects an email without @", () => {
        expect(Validator.isValidEmail("adrien.test.fr").status).toBe(false);
    });

    it("accepts a valid email", () => {
        expect(Validator.isValidEmail("adrien@test.fr").status).toBe(true);
    });
});

describe("Validator.isValidPassword", () => {
    it("rejects when the two passwords differ", () => {
        const result = Validator.isValidPassword("Azerty123", "Azerty124");
        expect(result.status).toBe(false);
        // app-facing error message stays in French, matching validator.js
        expect(result.message).toContain("différents");
    });

    it("rejects a password that is too short", () => {
        expect(Validator.isValidPassword("Az1", "Az1").status).toBe(false);
    });

    it("accepts a valid, confirmed password", () => {
        expect(Validator.isValidPassword("Azerty123", "Azerty123").status).toBe(true);
    });
});

describe("Validator.isValidChangePassword", () => {
    it("rejects when the new password is identical to the old one", () => {
        const result = Validator.isValidChangePassword("Azerty123", "Azerty123", "Azerty123");
        expect(result.status).toBe(false);
        // app-facing error message stays in French, matching validator.js
        expect(result.message).toContain("différent de l'ancien");
    });

    it("accepts a valid change", () => {
        const result = Validator.isValidChangePassword("Azerty123", "Azerty456", "Azerty456");
        expect(result.status).toBe(true);
    });
});

describe("Validator.isString / isBoolean / isPlainObject", () => {
    it("isString accepts only strings", () => {
        expect(Validator.isString("abc")).toBe(true);
        expect(Validator.isString("")).toBe(true);
        expect(Validator.isString(1)).toBe(false);
        expect(Validator.isString(undefined)).toBe(false);
    });

    it("isBoolean accepts only booleans", () => {
        expect(Validator.isBoolean(true)).toBe(true);
        expect(Validator.isBoolean(false)).toBe(true);
        expect(Validator.isBoolean("true")).toBe(false);
        expect(Validator.isBoolean(undefined)).toBe(false);
    });

    it("isPlainObject accepts an object but rejects null and arrays", () => {
        expect(Validator.isPlainObject({})).toBe(true);
        expect(Validator.isPlainObject({ a: 1 })).toBe(true);
        expect(Validator.isPlainObject(null)).toBe(false);
        expect(Validator.isPlainObject([])).toBe(false);
        expect(Validator.isPlainObject("object")).toBe(false);
        expect(Validator.isPlainObject(undefined)).toBe(false);
    });
});

describe("Validator.isValidImportFile", () => {
    it("rejects null/undefined/non-object payloads", () => {
        expect(Validator.isValidImportFile(null)).toBe(false);
        expect(Validator.isValidImportFile(undefined)).toBe(false);
        expect(Validator.isValidImportFile("shows")).toBe(false);
    });

    it("rejects a payload without a shows array", () => {
        expect(Validator.isValidImportFile({})).toBe(false);
        expect(Validator.isValidImportFile({ shows: "nope" })).toBe(false);
    });

    it("accepts the bare minimum: just a shows array", () => {
        expect(Validator.isValidImportFile({ shows: [] })).toBe(true);
    });

    it("accepts a real export - user/email live under user, not at the top level", () => {
        expect(Validator.isValidImportFile({
            user: { id: "u1", username: "test2", email: "test2@gmail.com", episodeTrackingEnabled: false },
            shows: [], playlists: [], favoriteActors: [], platforms: [],
        })).toBe(true);
    });

    it("accepts a payload with no user block at all", () => {
        expect(Validator.isValidImportFile({ shows: [], playlists: [{ name: "P" }] })).toBe(true);
    });

    it("rejects a non-boolean episodeTrackingEnabled", () => {
        expect(Validator.isValidImportFile({ shows: [], user: { episodeTrackingEnabled: "yes" } })).toBe(false);
    });

    it("rejects playlists/favoriteActors/platforms that aren't arrays when present", () => {
        expect(Validator.isValidImportFile({ shows: [], playlists: "nope" })).toBe(false);
        expect(Validator.isValidImportFile({ shows: [], favoriteActors: {} })).toBe(false);
        expect(Validator.isValidImportFile({ shows: [], platforms: "nope" })).toBe(false);
    });
});

describe("Validator.isValidShow", () => {
    it("rejects a show without an id", () => {
        expect(Validator.isValidShow({ title: "Breaking Bad", kinds: ["Drame"], seasons: 5 })).toBe(false);
    });

    it("rejects a show with an empty kinds array", () => {
        expect(Validator.isValidShow({ id: 1, title: "Breaking Bad", kinds: [], seasons: 5 })).toBe(false);
    });

    it("accepts a complete show", () => {
        expect(Validator.isValidShow({ id: 1, title: "Breaking Bad", kinds: ["Drame"], seasons: 5 })).toBe(true);
    });
});

describe("Validator.isValidImportedShow", () => {
    it("rejects null/undefined", () => {
        expect(Validator.isValidImportedShow(null)).toBe(false);
        expect(Validator.isValidImportedShow(undefined)).toBe(false);
    });

    it("rejects a non-object", () => {
        expect(Validator.isValidImportedShow("1")).toBe(false);
    });

    it("rejects a show with a non-integer id", () => {
        expect(Validator.isValidImportedShow({ id: "1" })).toBe(false);
        expect(Validator.isValidImportedShow({ id: 1.5 })).toBe(false);
        expect(Validator.isValidImportedShow({})).toBe(false);
    });

    it("accepts a show with an integer id", () => {
        expect(Validator.isValidImportedShow({ id: 1, title: "Breaking Bad" })).toBe(true);
    });

    it("accepts a show with no seasons field", () => {
        expect(Validator.isValidImportedShow({ id: 1 })).toBe(true);
    });

    it("rejects a show whose seasons field isn't an array", () => {
        expect(Validator.isValidImportedShow({ id: 1, seasons: "oops" })).toBe(false);
    });

    it("accepts a show with a seasons array", () => {
        expect(Validator.isValidImportedShow({ id: 1, seasons: [] })).toBe(true);
    });
});

describe("Validator.isValidImportedSeason", () => {
    it("rejects a season without a number", () => {
        expect(Validator.isValidImportedSeason({})).toBe(false);
        expect(Validator.isValidImportedSeason({ number: null })).toBe(false);
    });

    it("rejects a season with a non-integer number", () => {
        expect(Validator.isValidImportedSeason({ number: "1" })).toBe(false);
    });

    it("accepts a season with an integer number", () => {
        expect(Validator.isValidImportedSeason({ number: 1 })).toBe(true);
    });

    it("rejects a season whose episodes field isn't an array", () => {
        expect(Validator.isValidImportedSeason({ number: 1, episodes: "oops" })).toBe(false);
    });

    it("accepts a season with an episodes array", () => {
        expect(Validator.isValidImportedSeason({ number: 1, episodes: [] })).toBe(true);
    });
});

describe("Validator.isValidImportedEpisode", () => {
    it("rejects an episode without an episodeId", () => {
        expect(Validator.isValidImportedEpisode({})).toBe(false);
    });

    it("accepts an episode with an integer episodeId", () => {
        expect(Validator.isValidImportedEpisode({ episodeId: 42 })).toBe(true);
    });
});

describe("Validator.isValidImportedPlaylist", () => {
    it("rejects a playlist without a name", () => {
        expect(Validator.isValidImportedPlaylist({})).toBe(false);
        expect(Validator.isValidImportedPlaylist({ name: "" })).toBe(false);
        expect(Validator.isValidImportedPlaylist({ name: 42 })).toBe(false);
    });

    it("accepts a playlist with a name", () => {
        expect(Validator.isValidImportedPlaylist({ name: "Ma playlist" })).toBe(true);
    });

    it("rejects a playlist whose shows field isn't an array", () => {
        expect(Validator.isValidImportedPlaylist({ name: "Ma playlist", shows: "oops" })).toBe(false);
    });

    it("accepts a playlist with a shows array", () => {
        expect(Validator.isValidImportedPlaylist({ name: "Ma playlist", shows: [] })).toBe(true);
    });
});

describe("Validator.isValidImportedPlaylistShow", () => {
    it("rejects a show without an integer id", () => {
        expect(Validator.isValidImportedPlaylistShow({})).toBe(false);
        expect(Validator.isValidImportedPlaylistShow({ id: "1" })).toBe(false);
    });

    it("accepts a show with just an id, even with a numeric (non-array) seasons count", () => {
        // a playlist's exported shows are raw catalog rows - `seasons` is a season count here,
        // not the nested seasons array a top-level exported show carries under the same key
        expect(Validator.isValidImportedPlaylistShow({ id: 1, title: "Dark", seasons: 3 })).toBe(true);
    });
});

describe("Validator.isValidImportedActor", () => {
    it("rejects an actor without an id", () => {
        expect(Validator.isValidImportedActor({})).toBe(false);
    });

    it("accepts an actor with an integer id", () => {
        expect(Validator.isValidImportedActor({ id: 1, name: "Bryan Cranston" })).toBe(true);
    });
});

describe("Validator.isValidImportedPlatformId", () => {
    it("rejects a non-integer platform id", () => {
        expect(Validator.isValidImportedPlatformId("1")).toBe(false);
        expect(Validator.isValidImportedPlatformId(null)).toBe(false);
    });

    it("accepts an integer platform id", () => {
        expect(Validator.isValidImportedPlatformId(1)).toBe(true);
    });
});