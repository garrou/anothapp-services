/**
 * @param {Object} results task results keyed by task name, as returned by the task functions
 * @returns {string}
 */
const formatReport = (results) => {
    const lines = [];

    if (results.shows) {
        const {updated, toDelete, failed} = results.shows;
        lines.push(`${updated} série(s) synchronisée(s)`);
        if (toDelete.length > 0) {
            lines.push(`${toDelete.length} série(s) à supprimer (non supprimées automatiquement, à vérifier)`);
            toDelete.forEach((s) => lines.push(`    [${s.id} - ${s.title}]`));
        }
        if (failed.length > 0) {
            lines.push(`${failed.length} série(s) en erreur`);
            failed.forEach((s) => lines.push(`    [${s.id} - ${s.title}] ${s.error}`));
        }
    }
    if (results.seasons) {
        const {updated, deleted, failed} = results.seasons;
        lines.push(`${updated.length} saison(s) mise(s) à jour`);
        updated.forEach((s) => lines.push(`    [série ${s.showId} - saison ${s.number}]`));
        lines.push(`${deleted.length} saison(s) supprimée(s)`);
        deleted.forEach((s) => lines.push(`    [série ${s.show_id} - saison ${s.number}]`));
        if (failed.length > 0) {
            lines.push(`${failed.length} groupe(s) de saisons en erreur`);
            failed.forEach((s) => lines.push(`    [série ${s.showId}] ${s.error}`));
        }
    }
    if (results.episodes) {
        const {synced, deleted, failed} = results.episodes;
        lines.push(`${synced} épisode(s) synchronisé(s)`);
        lines.push(`${deleted} épisode(s) supprimé(s)`);
        if (failed.length > 0) {
            lines.push(`${failed.length} série(s) en erreur pour les épisodes`);
            failed.forEach((e) => lines.push(`    [série ${e.showId}] ${e.error}`));
        }
    }
    if (results.platforms) {
        const {upserted, failed} = results.platforms;
        lines.push(`${upserted} plateforme(s) synchronisée(s)`);
        if (failed.length > 0) {
            lines.push(`${failed.length} plateforme(s) en erreur`);
            failed.forEach((p) => lines.push(`    [${p.id} - ${p.name}] ${p.error}`));
        }
    }
    if (results.actors) {
        const {skipped, updated, toDelete, failed} = results.actors;

        if (skipped) {
            lines.push("Acteurs : pas de synchronisation aujourd'hui");
        } else {
            lines.push(`${updated} acteur(s) synchronisé(s)`);
            if (toDelete.length > 0) {
                lines.push(`${toDelete.length} acteur(s) à supprimer (non supprimés automatiquement, à vérifier)`);
                toDelete.forEach((a) => lines.push(`    [${a.id} - ${a.name}]`));
            }
            if (failed.length > 0) {
                lines.push(`${failed.length} acteur(s) en erreur`);
                failed.forEach((a) => lines.push(`    [${a.id} - ${a.name}] ${a.error}`));
            }
        }
    }
    if (results.reminders) {
        lines.push(`${results.reminders.created} rappel(s) d'épisode créé(s)`);
    }
    if (results.tokens) {
        lines.push(`${results.tokens.deleted} jeton(s) de renouvellement supprimé(s)`);
    }
    if (results.notifications) {
        lines.push(`${results.notifications.deleted} notification(s) supprimée(s)`);
    }
    return lines.join("\n");
};

export {formatReport};
