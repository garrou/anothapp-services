import ActorRepository from "../../repositories/actorRepository.js";
import betaseries from "../lib/betaseries.js";
import mapWithConcurrency from "../lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

// Actor bios/pictures change rarely, so this only actually runs once a week (Sunday)
// instead of every night like shows/episodes/platforms.
const ACTORS_SYNC_DAY = 0;

/**
 * @param {Actor} actor a row from the `actors` table
 * @returns {Promise<{deleted: true}|{deleted: false, name: string, picture: string?, birthday: string?, deathday: string?, nationality: string?, description: string?}>}
 */
const fetchActorUpdate = async (actor) => {
    const current = await betaseries.fetchPerson(actor.id);

    if (!current) {
        return {deleted: true};
    }
    return {
        deleted: false,
        name: current.name,
        picture: current.poster ?? null,
        birthday: current.birthday ?? null,
        deathday: current.deathday ?? null,
        nationality: current.nationality ?? null,
        description: current.description ?? null,
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
    const actors = await actorRepository.getAllActors();
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
    return {skipped: false, updated, toDelete, failed};
};

export default updateActors;
