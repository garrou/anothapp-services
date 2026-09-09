import ShowRepository from "../../repositories/showRepository.js";
import KindRepository from "../../repositories/kindRepository.js";

/**
 * One-off migration, not part of the scheduled TASKS pipeline: populates
 * shows_kinds from the legacy shows.kinds VARCHAR column, matching each
 * semicolon-separated display name against the kinds table. Run once by
 * hand (`node schedule/backfillShowsKinds.js`) after the `kinds` task has
 * populated the kinds table.
 *
 * Matching is by display name because that's all the legacy column ever
 * stored - a show whose name doesn't resolve (e.g. BetaSeries renamed the
 * genre since that show was last synced) is left untouched and reported
 * under orphanNames for manual review, rather than silently dropped.
 *
 * @returns {Promise<{updated: number, total: number, orphanNames: string[], failed: any[]}>}
 */
const backfillShowsKinds = async () => {
    const kindRepository = new KindRepository();
    const showRepository = new ShowRepository();

    const kinds = await kindRepository.getKinds();
    const idByName = new Map(kinds.map((kind) => [kind.name, kind.value]));

    const shows = await showRepository.getAllShows();
    const orphanNames = new Set();
    const failed = [];
    let updated = 0;

    for (const show of shows) {
        const names = (show.kinds ?? "").split(";").filter(Boolean);
        const kindIds = [];

        for (const name of names) {
            const id = idByName.get(name);

            if (id) {
                kindIds.push(id);
            } else {
                orphanNames.add(name);
            }
        }
        if (!kindIds.length) {
            continue;
        }

        try {
            await showRepository.setKinds(show.id, kindIds);
            updated += 1;
        } catch (error) {
            failed.push({id: show.id, title: show.title, error: error.message});
        }
    }
    return {updated, total: shows.length, orphanNames: [...orphanNames].sort(), failed};
};

export default backfillShowsKinds;
