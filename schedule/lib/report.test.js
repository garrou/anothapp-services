import {describe, expect, it} from "vitest";
import {formatReport} from "./report.js";

describe("formatReport", () => {
    it("formats shows and seasons results", () => {
        const report = formatReport({
            shows: {
                updated: [{id: 1, title: "Show A"}],
                toDelete: [],
                failed: [],
            },
            seasons: {
                updated: [{showId: 1, number: 2}],
                deleted: [{show_id: 1, number: 3}],
                failed: [],
            },
        });
        expect(report).toContain("1 série(s) mise(s) à jour");
        expect(report).toContain("[1 - Show A]");
        expect(report).toContain("1 saison(s) mise(s) à jour");
        expect(report).toContain("[série 1 - saison 2]");
        expect(report).toContain("1 saison(s) supprimée(s)");
        expect(report).not.toContain("à supprimer");
    });

    it("flags shows to delete without saying they were deleted", () => {
        const report = formatReport({
            shows: {
                updated: [],
                toDelete: [{id: 2, title: "Show B"}],
                failed: [],
            },
        });
        expect(report).toContain("1 série(s) à supprimer (non supprimées automatiquement, à vérifier)");
        expect(report).toContain("[2 - Show B]");
    });

    it("formats episodes results", () => {
        const report = formatReport({
            episodes: {
                synced: 12,
                deleted: 2,
                failed: [{showId: 1, error: "boom"}],
            },
        });
        expect(report).toContain("12 épisode(s) synchronisé(s)");
        expect(report).toContain("2 épisode(s) supprimé(s)");
        expect(report).toContain("1 série(s) en erreur pour les épisodes");
        expect(report).toContain("[série 1] boom");
    });

    it("formats platforms and tokens results", () => {
        const report = formatReport({
            platforms: {upserted: 5, failed: [{id: 1, name: "Netflix", error: "boom"}]},
            tokens: {deleted: 3},
        });
        expect(report).toContain("5 plateforme(s) synchronisée(s)");
        expect(report).toContain("1 plateforme(s) en erreur");
        expect(report).toContain("3 jeton(s) de renouvellement supprimé(s)");
    });

    it("only reports the tasks that ran", () => {
        const report = formatReport({tokens: {deleted: 0}});
        expect(report).toBe("0 jeton(s) de renouvellement supprimé(s)");
    });

    it("formats notifications results", () => {
        const report = formatReport({notifications: {deleted: 12}});
        expect(report).toBe("12 notification(s) supprimée(s)");
    });

    it("formats reminders results", () => {
        const report = formatReport({reminders: {created: 5}});
        expect(report).toBe("5 rappel(s) d'épisode créé(s)");
    });
});
