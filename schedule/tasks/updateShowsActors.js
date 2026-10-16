import ShowRepository from "../../repositories/showRepository.js";
import betaseries from "../lib/betaseries.js";
import mapWithConcurrency from "../lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

// Batched rather than run once over the whole catalog: it both backfills shows that pre-date
// this feature and catches newly imported shows going forward, a bit at a time, run after run.
const BATCH_SIZE = parseInt(process.env.SHOWS_ACTORS_BATCH_SIZE ?? "100", 10);

/**
 * @returns {Promise<{processed: number, failed: any[]}>}
 */
const updateShowsActors = async () => {
    const showRepository = new ShowRepository();
    const showIds = await showRepository.getShowIdsNeedingCastSync(BATCH_SIZE);
    const results = await mapWithConcurrency(showIds, CONCURRENCY, async (showId) => {
        const cast = await betaseries.fetchCharacters(showId);
        await showRepository.setCast(showId, cast);
    });

    const failed = [];
    let processed = 0;

    for (let i = 0; i < showIds.length; i += 1) {
        if (results[i].status === "rejected") {
            failed.push({id: showIds[i], error: results[i].reason?.message ?? String(results[i].reason)});
        } else {
            processed += 1;
        }
    }
    return {processed, failed};
};

export default updateShowsActors;
