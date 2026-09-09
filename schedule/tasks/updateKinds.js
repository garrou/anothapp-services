import KindRepository from "../../repositories/kindRepository.js";
import betaseries from "../lib/betaseries.js";
import mapWithConcurrency from "../lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

/**
 * @returns {Promise<{upserted: number, failed: any[]}>}
 */
const updateKinds = async () => {
    const kindRepository = new KindRepository();
    const kinds = await betaseries.fetchGenres();
    const results = await mapWithConcurrency(kinds, CONCURRENCY, (kind) =>
        kindRepository.upsertKind(kind.id, kind.name)
    );

    let upserted = 0;
    const failed = [];

    for (let i = 0; i < kinds.length; i += 1) {
        const result = results[i];

        if (result.status === "rejected") {
            failed.push({id: kinds[i].id, name: kinds[i].name, error: result.reason?.message ?? String(result.reason)});
        } else {
            upserted += 1;
        }
    }
    return {upserted, failed};
};

export default updateKinds;
