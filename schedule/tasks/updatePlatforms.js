import PlatformRepository from "../../repositories/platformRepository.js";
import betaseries from "../lib/betaseries.js";
import mapWithConcurrency from "../lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

/**
 * @returns {Promise<{upserted: number, failed: any[]}>}
 */
const updatePlatforms = async () => {
    const platformRepository = new PlatformRepository();
    const platforms = await betaseries.fetchPlatforms();
    const results = await mapWithConcurrency(platforms, CONCURRENCY, (platform) =>
        platformRepository.upsertPlatform(platform.id, platform.name, platform.logo ?? "")
    );

    let upserted = 0;
    const failed = [];

    for (let i = 0; i < platforms.length; i += 1) {
        const result = results[i];

        if (result.status === "rejected") {
            failed.push({id: platforms[i].id, name: platforms[i].name, error: result.reason?.message ?? String(result.reason)});
        } else {
            upserted += 1;
        }
    }
    return {upserted, failed};
};

export default updatePlatforms;
