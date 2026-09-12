import {describe, expect, it} from "vitest";
import {formatReport} from "./report.js";

describe("formatReport", () => {
    it("formats shows and seasons results", () => {
        const report = formatReport({
            shows: {
                updated: 1,
                toDelete: [],
                failed: [],
            },
            seasons: {
                updated: [{showId: 1, number: 2}],
                deleted: [{show_id: 1, number: 3}],
                failed: [],
            },
        });
        expect(report).toContain("<b>1</b> série(s) synchronisée(s)");
        expect(report).toContain("<b>1</b> saison(s) mise(s) à jour");
        expect(report).toContain("[série 1 - saison 2]");
        expect(report).toContain("<b>1</b> saison(s) supprimée(s)");
        expect(report).not.toContain("à supprimer");
        expect(report).not.toContain("Détail des erreurs");
    });

    it("flags shows to delete without saying they were deleted", () => {
        const report = formatReport({
            shows: {
                updated: 0,
                toDelete: [{id: 2, title: "Show B"}],
                failed: [],
            },
        });
        expect(report).toContain("<b>1</b> série(s) à supprimer (non supprimées automatiquement, à vérifier)");
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
        expect(report).toContain("<b>12</b> épisode(s) synchronisé(s)");
        expect(report).toContain("<b>2</b> épisode(s) supprimé(s)");
        expect(report).toContain("⚠️ <b>1</b> série(s) en erreur pour les épisodes");
        expect(report).toContain("[série 1] boom");
    });

    it("formats platforms and tokens results", () => {
        const report = formatReport({
            platforms: {upserted: 5, failed: [{id: 1, name: "Netflix", error: "boom"}]},
            tokens: {deleted: 3},
        });
        expect(report).toContain("<b>5</b> plateforme(s) synchronisée(s)");
        expect(report).toContain("⚠️ <b>1</b> plateforme(s) en erreur");
        expect(report).toContain("<b>3</b> jeton(s) de renouvellement supprimé(s)");
        expect(report).toContain("[1 - Netflix] boom");
    });

    it("formats kinds results", () => {
        const report = formatReport({
            kinds: {upserted: 4, failed: [{id: 9, name: "Drame", error: "boom"}]},
        });
        expect(report).toContain("<b>4</b> genre(s) synchronisé(s)");
        expect(report).toContain("⚠️ <b>1</b> genre(s) en erreur");
        expect(report).toContain("[9 - Drame] boom");
    });

    it("formats actors results", () => {
        const report = formatReport({
            actors: {
                skipped: false,
                updated: 3,
                toDelete: [{id: 99, name: "Deleted Actor"}],
                failed: [{id: 1, name: "Actor A", error: "boom"}],
            },
        });
        expect(report).toContain("<b>3</b> acteur(s) synchronisé(s)");
        expect(report).toContain("<b>1</b> acteur(s) à supprimer (non supprimés automatiquement, à vérifier)");
        expect(report).toContain("[99 - Deleted Actor]");
        expect(report).toContain("⚠️ <b>1</b> acteur(s) en erreur");
        expect(report).toContain("[1 - Actor A] boom");
    });

    it("reports when the actors sync was skipped for the day", () => {
        const report = formatReport({
            actors: {skipped: true, updated: 0, toDelete: [], failed: []},
        });
        expect(report).toBe("🎭 Acteurs : pas de synchronisation aujourd'hui");
    });

    it("only reports the tasks that ran", () => {
        const report = formatReport({tokens: {deleted: 0}});
        expect(report).toBe("🔑 <b>0</b> jeton(s) de renouvellement supprimé(s)");
    });

    it("formats notifications results", () => {
        const report = formatReport({notifications: {deleted: 12}});
        expect(report).toBe("🗑️ <b>12</b> notification(s) supprimée(s)");
    });

    it("formats reminders results", () => {
        const report = formatReport({reminders: {created: 5}});
        expect(report).toBe("🔔 <b>5</b> rappel(s) d'épisode créé(s)");
    });

    it("formats user count results", () => {
        const report = formatReport({users: {total: 128}});
        expect(report).toBe("👥 <b>128</b> utilisateur(s) au total");
    });

    it("formats database size results", () => {
        const report = formatReport({database: {size: "128 MB"}});
        expect(report).toBe("💾 Taille de la base : <b>128 MB</b>");
    });

    it("formats accountAgeAchievements results", () => {
        const report = formatReport({
            accountAgeAchievements: {
                skipped: false, evaluated: 6, total: 7,
                failed: [{userId: "user-1", error: "boom"}],
            },
        });
        expect(report).toContain("<b>6/7</b> utilisateur(s) évalué(s) pour l'ancienneté du compte");
        expect(report).toContain("⚠️ <b>1</b> utilisateur(s) en erreur");
        expect(report).toContain("[user-1] boom");
    });

    it("reports when the account age evaluation was skipped for the day", () => {
        const report = formatReport({
            accountAgeAchievements: {skipped: true, evaluated: 0, total: 0, failed: []},
        });
        expect(report).toBe("🎂 Ancienneté du compte : pas d'évaluation aujourd'hui");
    });

    it("escapes HTML-sensitive characters from external data", () => {
        const report = formatReport({
            shows: {
                updated: 0,
                toDelete: [],
                failed: [{id: 1, title: "Show <script> & co", error: 'duplicate key "kinds_name_key"'}],
            },
        });
        expect(report).toContain("Show &lt;script&gt; &amp; co");
        expect(report).not.toContain("<script>");
        expect(report).toContain('duplicate key "kinds_name_key"');
    });

    it("builds a single consolidated error panel across every task, wrapped in a blockquote", () => {
        const report = formatReport({
            shows: {updated: 0, toDelete: [], failed: [{id: 1, title: "Show A", error: "boom A"}]},
            platforms: {upserted: 0, failed: [{id: 2, name: "Netflix", error: "boom B"}]},
        });
        const panelStart = report.indexOf("<blockquote>");
        const panelEnd = report.indexOf("</blockquote>");

        expect(report).toContain("🚨 <b>Détail des erreurs (2)</b>");
        expect(panelStart).toBeGreaterThan(-1);
        expect(panelEnd).toBeGreaterThan(panelStart);
        expect(report).toContain("<b>Séries</b>");
        expect(report).toContain("<b>Plateformes</b>");
        // the itemized detail lines live inside the panel, not scattered in the per-task sections above
        expect(report.indexOf("[1 - Show A] boom A")).toBeGreaterThan(panelStart);
        expect(report.indexOf("[2 - Netflix] boom B")).toBeGreaterThan(panelStart);
    });

    it("omits the error panel entirely when nothing failed", () => {
        const report = formatReport({shows: {updated: 5, toDelete: [], failed: []}});
        expect(report).not.toContain("Détail des erreurs");
        expect(report).not.toContain("<blockquote>");
    });
});
