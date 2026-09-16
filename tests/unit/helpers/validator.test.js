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