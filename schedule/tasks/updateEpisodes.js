import EpisodeRepository from "../../repositories/episodeRepository.js";
import betaseries from "../lib/betaseries.js";
import mapWithConcurrency from "../lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

/**
 * @param {number} showId
 * @returns {Promise<{showId: number, bySeason: Map<number, any[]>}>}
 */
const fetchShow = async (showId) => {
    const episodes = await betaseries.fetchEpisodes(showId);
    const bySeason = new Map();

    for (const episode of episodes) {
        if (!bySeason.has(episode.season)) {
            bySeason.set(episode.season, []);
        }
        bySeason.get(episode.season).push(episode);
    }
    return {showId, bySeason};
};

/**
 * @returns {Promise<{synced: number, deleted: number, failed: any[]}>}
 */
const updateEpisodes = async () => {
    const episodeRepository = new EpisodeRepository();
    const groups = await episodeRepository.getAllEpisodeSeasons();
    const showIds = [...new Set(groups.map((g) => g.show_id))];
    const results = await mapWithConcurrency(showIds, CONCURRENCY, fetchShow);

    const bySeasonByShow = new Map();
    const failedShows = new Set();
    const failed = [];

    for (let i = 0; i < showIds.length; i += 1) {
        const result = results[i];

        if (result.status === "rejected") {
            failedShows.add(showIds[i]);
            failed.push({showId: showIds[i], error: result.reason?.message ?? String(result.reason)});
            continue;
        }
        bySeasonByShow.set(showIds[i], result.value.bySeason);
    }

    let synced = 0;
    let deleted = 0;

    for (const group of groups) {
        if (failedShows.has(group.show_id)) {
            continue;
        }
        const episodes = bySeasonByShow.get(group.show_id)?.get(group.season_number) ?? [];

        for (const episode of episodes) {
            await episodeRepository.upsertEpisode(
                episode.id, group.show_id, group.season_number, episode.episode, episode.title,
                episode.code, episode.global, episode.length, episode.date, episode.description
            );
            synced += 1;
        }
        deleted += await episodeRepository.deleteEpisodesNotIn(group.show_id, group.season_number, episodes.map((e) => e.id));
    }
    return {synced, deleted, failed};
};

export default updateEpisodes;
