import ActorRepository from "../../repositories/actorRepository.js";
import betaseries from "../lib/betaseries.js";
import mapWithConcurrency from "../lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

const ACTORS_SYNC_DAY = 0;

/**
 * @param {Actor} actor a row from the `actors` table
 * @returns {Promise<{deleted: true}|{deleted: false, seriesIds: number[], name: string, picture: string?, birthday: string?, deathday: string?, nationality: string?, description: string?}>}
 */
const fetchActorUpdate = async (actor) => {
    const current = await betaseries.fetchPerson(actor.id);

    if (!current) {
        return {deleted: true};
    }
    return {
        deleted: false,
        seriesIds: (current.shows ?? []).map((s) => parseInt(s.show?.id)).filter((id) => !Number.isNaN(id)),
        name: current.name || actor.name,
        picture: current.poster ?? actor.picture ?? null,
        birthday: current.birthday ?? actor.birthday ?? null,
        deathday: current.deathday ?? actor.deathday ?? null,
        nationality: current.nationality ?? actor.nationality ?? null,
        description: current.description ?? actor.description ?? null,
    };
};

/**
 * @returns {Promise<{skipped: boolean, updated: number, toDelete: any[], failed: any[]}>}
 */
const updateActors = async () => {
    if (new Date().getDay() !== ACTORS_SYNC_DAY) {
        return {skipped: true, updated: 0, toDelete: [], failed: []};
    }
    const actorRepository = new ActorRepository();
    const actors = await actorRepository.getFavoritedActors();
    const results = await mapWithConcurrency(actors, CONCURRENCY, fetchActorUpdate);

    const failed = [];
    const toDelete = [];
    const toUpdate = [];

    for (let i = 0; i < actors.length; i += 1) {
        const result = results[i];

        if (result.status === "rejected") {
            failed.push({id: actors[i].id, name: actors[i].name, error: result.reason?.message ?? String(result.reason)});
        } else if (result.value.deleted) {
            toDelete.push(actors[i]);
        } else {
            toUpdate.push({actor: actors[i], changes: result.value});
        }
    }

    const applied = await mapWithConcurrency(toUpdate, CONCURRENCY, ({actor, changes}) =>
        actorRepository.updateActor(actor.id, changes)
    );

    let updated = 0;

    for (let i = 0; i < toUpdate.length; i += 1) {
        const {actor} = toUpdate[i];
        const result = applied[i];

        if (result.status === "rejected") {
            failed.push({id: actor.id, name: actor.name, error: result.reason?.message ?? String(result.reason)});
        } else {
            updated += 1;
        }
    }

    // Independent of the profile update above: links this actor to every show already in our
    // catalog that their filmography mentions, so a favorite keeps feeding the actor-based
    // recommendation signal (userShowRepository#getRecommendationsByUserId) even when nothing
    // about their profile itself changed this week.
    const linked = await mapWithConcurrency(toUpdate, CONCURRENCY, ({actor, changes}) =>
        actorRepository.linkShows(actor.id, changes.seriesIds)
    );

    for (let i = 0; i < toUpdate.length; i += 1) {
        const {actor} = toUpdate[i];
        const result = linked[i];

        if (result.status === "rejected") {
            failed.push({id: actor.id, name: actor.name, error: result.reason?.message ?? String(result.reason)});
        }
    }
    return {skipped: false, updated, toDelete, failed};
};

export default updateActors;
