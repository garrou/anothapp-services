import PlatformRepository from "../../repositories/platformRepository.js";
import betaseries from "../lib/betaseries.js";

/**
 * Syncs the `platforms` table with BetaSeries' catalog (adds new platforms, refreshes
 * name/logo of existing ones). Never deletes a platform: existing users_platforms /
 * users_seasons rows reference these ids and BetaSeries removing an entry from its
 * catalog shouldn't silently break a user's history.
 * @returns {Promise<{upserted: number, failed: any[]}>}
 */
const updatePlatforms = async () => {
    const platformRepository = new PlatformRepository();
    const platforms = await betaseries.fetchPlatforms();
    let upserted = 0;
    const failed = [];

    for (const platform of platforms) {
        try {
            await platformRepository.upsertPlatform(platform.id, platform.name, platform.logo ?? "");
            upserted += 1;
        } catch (error) {
            failed.push({id: platform.id, name: platform.name, error: error.message});
        }
    }
    return {upserted, failed};
};

export default updatePlatforms;
