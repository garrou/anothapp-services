import ShowRepository from "../../repositories/showRepository.js";
import betaseries from "../lib/betaseries.js";
import mapWithConcurrency from "../lib/concurrency.js";
import {getImageUrl} from "../../models/apiShow.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

/**
 * @param {Object} show a row from the `shows` table
 * @returns {Promise<{deleted: true}|{deleted: false, poster: string, kinds: string, duration: number, seasons: number, country: string, finished: boolean, nextEpisode: string}|null>}
 *          null when nothing changed
 */
const compareShow = async (show) => {
    const current = await betaseries.fetchShow(show.id);

    if (!current) {
        return {deleted: true};
    }
    const kinds = Object.values(current.genres ?? {}).join(";");
    const poster = getImageUrl(current.images);
    const seasons = (current.seasons_details ?? []).length;
    const finished = current.status === "Ended";
    const parsedDuration = parseInt(current.length ?? "0");
    const duration = parsedDuration || show.duration;
    const country = current.country || show.country;
    const nextEpisode = finished ? "" : await betaseries.fetchNextEpisodeDate(show.id);

    const unchanged = show.poster === poster
        && show.kinds === kinds
        && show.seasons === seasons
        && show.country === country
        && show.duration === duration
        && show.finished === finished
        && (show.next_episode ?? "") === nextEpisode;

    return unchanged ? null : {deleted: false, poster, kinds, duration, seasons, country, finished, nextEpisode};
};

/**
 * Compares every show in database against the BetaSeries API and applies the changes:
 * updates shows that changed, deletes shows that no longer exist on BetaSeries. The DB
 * writes run through the same bounded pool as the API comparisons - the pg pool already
 * allows up to 20 connections at once (config/db.js), so this is safe to parallelize too.
 * @returns {Promise<{updated: any[], deleted: any[], failed: any[]}>}
 */
const updateShows = async () => {
    const showRepository = new ShowRepository();
    const shows = await showRepository.getAllShows();
    const comparisons = await mapWithConcurrency(shows, CONCURRENCY, compareShow);

    const failed = [];
    const toApply = [];

    for (let i = 0; i < shows.length; i += 1) {
        const result = comparisons[i];

        if (result.status === "rejected") {
            failed.push({id: shows[i].id, title: shows[i].title, error: result.reason?.message ?? String(result.reason)});
        } else if (result.value) {
            toApply.push({show: shows[i], changes: result.value});
        }
    }

    const applied = await mapWithConcurrency(toApply, CONCURRENCY, ({show, changes}) =>
        changes.deleted ? showRepository.deleteShow(show.id) : showRepository.updateShow(show.id, changes)
    );

    const updated = [];
    const deleted = [];

    for (let i = 0; i < toApply.length; i += 1) {
        const {show, changes} = toApply[i];
        const result = applied[i];

        if (result.status === "rejected") {
            failed.push({id: show.id, title: show.title, error: result.reason?.message ?? String(result.reason)});
        } else if (changes.deleted) {
            deleted.push(show);
        } else {
            updated.push(show);
        }
    }
    return {updated, deleted, failed};
};

export default updateShows;
