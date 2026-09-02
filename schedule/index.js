import "dotenv/config";
import updateShows from "./tasks/updateShows.js";
import updateSeasons from "./tasks/updateSeasons.js";
import updateEpisodes from "./tasks/updateEpisodes.js";
import updatePlatforms from "./tasks/updatePlatforms.js";
import updateActors from "./tasks/updateActors.js";
import remindUpcomingEpisodes from "./tasks/remindUpcomingEpisodes.js";
import cleanupRefreshTokens from "./tasks/cleanupRefreshTokens.js";
import cleanupNotifications from "./tasks/cleanupNotifications.js";
import reportUserCount from "./tasks/reportUserCount.js";
import sendTelegramMessage from "./lib/notify.js";
import {formatReport} from "./lib/report.js";

const TASKS = {
    shows: updateShows,
    seasons: updateSeasons,
    episodes: updateEpisodes,
    platforms: updatePlatforms,
    actors: updateActors,
    reminders: remindUpcomingEpisodes,
    tokens: cleanupRefreshTokens,
    notifications: cleanupNotifications,
    users: reportUserCount,
};

/**
 * @param {string[]} args
 * @returns {string[]} task names in TASKS order, regardless of the order given in args
 */
const resolveTasks = (args) => {
    const requested = Object.keys(TASKS).filter((name) => args.includes(name));
    return requested.length > 0 ? requested : Object.keys(TASKS);
};

/**
 * @returns {Promise<boolean>} true when at least one task reported a failure
 */
const run = async () => {
    const names = resolveTasks(process.argv.slice(2));
    const results = {};

    for (const name of names) {
        console.log(`> ${name}`);
        results[name] = await TASKS[name]();
        console.log(results[name]);
    }
    await sendTelegramMessage(formatReport(results));
    return Object.values(results).some((r) => (r.failed?.length ?? 0) > 0);
};

run()
    .then((hasFailures) => process.exit(hasFailures ? 1 : 0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
