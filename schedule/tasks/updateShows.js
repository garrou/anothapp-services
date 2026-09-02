import ShowRepository from "../../repositories/showRepository.js";
import betaseries from "../lib/betaseries.js";
import mapWithConcurrency from "../lib/concurrency.js";
import {getImageUrl} from "../../models/apiShow.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

/**
 * @param {Object} show a row from the `shows` table
 * @returns {Promise<{deleted: true}|{deleted: false, poster: string, kinds: string, duration: number, seasons: number, country: string, finished: boolean, nextEpisode: string, description: string?, creation: number?, network: string?, language: string?, episodes: number?}>}
 */
const fetchShowUpdate = async (show) => {
    const current = await betaseries.fetchShow(show.id);

    if (!current) {
        return {deleted: true};
    }
    const kinds = Object.values(current.genres ?? {}).join(";");
    const poster = getImageUrl(current.images);
    const finished = current.status === "Ended";
    const parsedDuration = parseInt(current.length ?? "0");
    const duration = parsedDuration || show.duration;
    const country = current.country || show.country;
    const [currentSeasons, nextEpisode] = await Promise.all([
        betaseries.fetchSeasons(show.id),
        finished ? Promise.resolve("") : betaseries.fetchNextEpisodeDate(show.id),
    ]);
    const seasons = currentSeasons.length;
    const parsedCreation = parseInt(current.creation);
    const parsedEpisodes = parseInt(current.episodes);

    return {
        deleted: false, poster, kinds, duration, seasons, country, finished, nextEpisode,
        description: current.description ?? show.description ?? null,
        creation: Number.isNaN(parsedCreation) ? (show.creation ?? null) : parsedCreation,
        network: current.network ?? show.network ?? null,
        language: current.language ?? show.language ?? null,
        episodes: Number.isNaN(parsedEpisodes) ? (show.episodes ?? null) : parsedEpisodes,
    };
};

/**
 * @returns {Promise<{updated: number, toDelete: any[], failed: any[]}>}
 */
const updateShows = async () => {
    const showRepository = new ShowRepository();
    const shows = await showRepository.getAllShows();
    const results = await mapWithConcurrency(shows, CONCURRENCY, fetchShowUpdate);

    const failed = [];
    const toDelete = [];
    const toUpdate = [];

    for (let i = 0; i < shows.length; i += 1) {
        const result = results[i];

        if (result.status === "rejected") {
            failed.push({id: shows[i].id, title: shows[i].title, error: result.reason?.message ?? String(result.reason)});
        } else if (result.value.deleted) {
            toDelete.push(shows[i]);
        } else {
            toUpdate.push({show: shows[i], changes: result.value});
        }
    }

    const applied = await mapWithConcurrency(toUpdate, CONCURRENCY, ({show, changes}) =>
        showRepository.updateShow(show.id, changes)
    );

    let updated = 0;

    for (let i = 0; i < toUpdate.length; i += 1) {
        const {show} = toUpdate[i];
        const result = applied[i];

        if (result.status === "rejected") {
            failed.push({id: show.id, title: show.title, error: result.reason?.message ?? String(result.reason)});
        } else {
            updated += 1;
        }
    }
    return {updated, toDelete, failed};
};

export default updateShows;
