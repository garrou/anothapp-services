import "dotenv/config";
import backfillAchievements from "./tasks/backfillAchievements.js";

backfillAchievements()
    .then((result) => {
        console.log(result);
        process.exit(result.failed.length > 0 ? 1 : 0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
