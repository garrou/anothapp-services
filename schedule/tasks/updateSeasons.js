import SeasonRepository from "../../repositories/seasonRepository.js";
import betaseries from "../lib/betaseries.js";
import mapWithConcurrency from "../lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

/**
 * @param {any[]} seasons every DB row for a single show, ordered by number
 * @returns {Promise<{updated: any[], deleted: any[]}>}
 */
const compareShowSeasons = async (seasons) => {
    const showId = seasons[0].show_id;
    const current = await betaseries.fetchSeasons(showId);
    const updated = [];
    const deleted = [];

    for (const season of seasons) {
        if (season.number > current.length) {
            deleted.push(season);
            continue;
        }
        const currSeason = current[season.number - 1];

        if (currSeason?.number === season.number
            && (season.episodes !== currSeason.episodes || (currSeason.image && season.image !== currSeason.image))) {
            updated.push({showId, number: currSeason.number, episodes: currSeason.episodes, image: currSeason.image});
        }
    }
    return {updated, deleted};
};

/**
 * Compares every season in database against the BetaSeries API and applies the changes.
 * Must run after updateShows(): a show deleted there cascades its seasons away, so this
 * only needs to catch season-count mismatches on shows that are still around.
 * @returns {Promise<{updated: any[], deleted: any[], failed: any[]}>}
 */
const updateSeasons = async () => {
    const seasonRepository = new SeasonRepository();
    const seasons = await seasonRepository.getAllSeasons();
    const byShow = new Map();

    for (const season of seasons) {
        if (!byShow.has(season.show_id)) {
            byShow.set(season.show_id, []);
        }
        byShow.get(season.show_id).push(season);
    }
    const groups = [...byShow.values()];
    const results = await mapWithConcurrency(groups, CONCURRENCY, compareShowSeasons);

    const updated = [];
    const deleted = [];
    const failed = [];

    for (let i = 0; i < groups.length; i += 1) {
        const result = results[i];

        if (result.status === "rejected") {
            failed.push({showId: groups[i][0].show_id, error: result.reason?.message ?? String(result.reason)});
            continue;
        }
        for (const season of result.value.updated) {
            await seasonRepository.updateSeasonEpisodesImage(season.showId, season.number, season.episodes, season.image ?? "");
            updated.push(season);
        }
        for (const season of result.value.deleted) {
            await seasonRepository.deleteSeasonByShowIdByNumber(season.show_id, season.number);
            deleted.push(season);
        }
    }
    await seasonRepository.fillMissingSeasonImages();
    return {updated, deleted, failed};
};

export default updateSeasons;
