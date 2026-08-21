import {describe, expect, it} from "vitest";
import {formatReport} from "./report.js";

describe("formatReport", () => {
    it("formats shows and seasons results", () => {
        const report = formatReport({
            shows: {
                updated: [{id: 1, title: "Show A"}],
                deleted: [],
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
});
