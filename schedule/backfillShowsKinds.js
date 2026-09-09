import "dotenv/config";
import backfillShowsKinds from "./tasks/backfillShowsKinds.js";

backfillShowsKinds()
    .then((result) => {
        console.log(result);
        process.exit(result.failed.length > 0 ? 1 : 0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
