/**
 * @param {any} value
 * @returns {string}
 */
const escapeHtml = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/**
 * @param {Object} results task results keyed by task name, as returned by the task functions
 * @returns {string}
 */
const formatReport = (results) => {
    const lines = [];
    const errorGroups = [];

    /**
     * @param {string} label e.g. "Séries"
     * @param {string} countLabel e.g. "série(s) en erreur"
     * @param {any[]} failed
     * @param {(item: any) => string} formatItem
     */
    const reportFailures = (label, countLabel, failed, formatItem) => {
        if (failed.length === 0) {
            return;
        }
        lines.push(`⚠️ <b>${failed.length}</b> ${countLabel}`);
        errorGroups.push({label, items: failed.map(formatItem)});
    };

    if (results.shows) {
        const {updated, toDelete, failed} = results.shows;
        lines.push(`📺 <b>${updated}</b> série(s) synchronisée(s)`);
        if (toDelete.length > 0) {
            lines.push(`🗑️ <b>${toDelete.length}</b> série(s) à supprimer (non supprimées automatiquement, à vérifier)`);
            toDelete.forEach((s) => lines.push(`    [${s.id} - ${escapeHtml(s.title)}]`));
        }
        reportFailures("Séries", "série(s) en erreur", failed, (s) => `[${s.id} - ${escapeHtml(s.title)}] ${escapeHtml(s.error)}`);
    }
    if (results.seasons) {
        const {updated, deleted, failed} = results.seasons;
        lines.push(`🎬 <b>${updated.length}</b> saison(s) mise(s) à jour`);
        updated.forEach((s) => lines.push(`    [série ${s.showId} - saison ${s.number}]`));
        lines.push(`🗑️ <b>${deleted.length}</b> saison(s) supprimée(s)`);
        deleted.forEach((s) => lines.push(`    [série ${s.show_id} - saison ${s.number}]`));
        reportFailures("Saisons", "groupe(s) de saisons en erreur", failed, (s) => `[série ${s.showId}] ${escapeHtml(s.error)}`);
    }
    if (results.episodes) {
        const {synced, deleted, failed} = results.episodes;
        lines.push(`▶️ <b>${synced}</b> épisode(s) synchronisé(s)`);
        lines.push(`🗑️ <b>${deleted}</b> épisode(s) supprimé(s)`);
        reportFailures("Épisodes", "série(s) en erreur pour les épisodes", failed, (e) => `[série ${e.showId}] ${escapeHtml(e.error)}`);
    }
    if (results.platforms) {
        const {upserted, failed} = results.platforms;
        lines.push(`🎥 <b>${upserted}</b> plateforme(s) synchronisée(s)`);
        reportFailures("Plateformes", "plateforme(s) en erreur", failed, (p) => `[${p.id} - ${escapeHtml(p.name)}] ${escapeHtml(p.error)}`);
    }
    if (results.kinds) {
        const {upserted, failed} = results.kinds;
        lines.push(`🏷️ <b>${upserted}</b> genre(s) synchronisé(s)`);
        reportFailures("Genres", "genre(s) en erreur", failed, (k) => `[${k.id} - ${escapeHtml(k.name)}] ${escapeHtml(k.error)}`);
    }
    if (results.actors) {
        const {skipped, updated, toDelete, failed} = results.actors;

        if (skipped) {
            lines.push("🎭 Acteurs : pas de synchronisation aujourd'hui");
        } else {
            lines.push(`🎭 <b>${updated}</b> acteur(s) synchronisé(s)`);
            if (toDelete.length > 0) {
                lines.push(`🗑️ <b>${toDelete.length}</b> acteur(s) à supprimer (non supprimés automatiquement, à vérifier)`);
                toDelete.forEach((a) => lines.push(`    [${a.id} - ${escapeHtml(a.name)}]`));
            }
            reportFailures("Acteurs", "acteur(s) en erreur", failed, (a) => `[${a.id} - ${escapeHtml(a.name)}] ${escapeHtml(a.error)}`);
        }
    }
    if (results.reminders) {
        lines.push(`🔔 <b>${results.reminders.created}</b> rappel(s) d'épisode créé(s)`);
    }
    if (results.tokens) {
        lines.push(`🔑 <b>${results.tokens.deleted}</b> jeton(s) de renouvellement supprimé(s)`);
    }
    if (results.notifications) {
        lines.push(`🗑️ <b>${results.notifications.deleted}</b> notification(s) supprimée(s)`);
    }
    if (results.users) {
        lines.push(`👥 <b>${results.users.total}</b> utilisateur(s) au total`);
    }
    if (results.accountAgeAchievements) {
        const {skipped, evaluated, total, failed} = results.accountAgeAchievements;

        if (skipped) {
            lines.push("🎂 Ancienneté du compte : pas d'évaluation aujourd'hui");
        } else {
            lines.push(`🎂 <b>${evaluated}/${total}</b> utilisateur(s) évalué(s) pour l'ancienneté du compte`);
            reportFailures("Ancienneté du compte", "utilisateur(s) en erreur", failed, (f) => `[${f.userId}] ${escapeHtml(f.error)}`);
        }
    }
    if (results.database) {
        lines.push(`💾 Taille de la base : <b>${results.database.size}</b>`);
    }
    if (errorGroups.length > 0) {
        const totalErrors = errorGroups.reduce((acc, group) => acc + group.items.length, 0);
        lines.push("", `🚨 <b>Détail des erreurs (${totalErrors})</b>`, "<blockquote>");
        errorGroups.forEach(({label, items}) => {
            lines.push(`<b>${label}</b>`);
            items.forEach((item) => lines.push(`    ${item}`));
        });
        lines.push("</blockquote>");
    }
    return lines.join("\n");
};

export {formatReport};
