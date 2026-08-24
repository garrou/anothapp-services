import EpisodeRepository from "../../repositories/episodeRepository.js";
import betaseries from "../lib/betaseries.js";
import mapWithConcurrency from "../lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

/**
 * @param {{show_id: number, season_number: number}} group
 * @returns {Promise<{showId: number, seasonNumber: number, episodes: any[]}>}
 */
const fetchGroup = async (group) => {
    const episodes = await betaseries.fetchEpisodes(group.show_id, group.season_number);
    return {showId: group.show_id, seasonNumber: group.season_number, episodes};
};

/**
 * @returns {Promise<{synced: number, deleted: number, failed: any[]}>}
 */
const updateEpisodes = async () => {
    const episodeRepository = new EpisodeRepository();
    const groups = await episodeRepository.getAllEpisodeSeasons();
    const results = await mapWithConcurrency(groups, CONCURRENCY, fetchGroup);

    let synced = 0;
    let deleted = 0;
    const failed = [];

    for (let i = 0; i < groups.length; i += 1) {
        const result = results[i];

        if (result.status === "rejected") {
            failed.push({
                showId: groups[i].show_id,
                seasonNumber: groups[i].season_number,
                error: result.reason?.message ?? String(result.reason),
            });
            continue;
        }
        const {showId, seasonNumber, episodes} = result.value;

        for (const episode of episodes) {
            await episodeRepository.upsertEpisode(
                episode.id, showId, seasonNumber, episode.episode, episode.title,
                episode.code, episode.global, episode.length, episode.date
            );
            synced += 1;
        }
        deleted += await episodeRepository.deleteEpisodesNotIn(showId, seasonNumber, episodes.map((e) => e.id));
    }
    return {synced, deleted, failed};
};

export default updateEpisodes;
