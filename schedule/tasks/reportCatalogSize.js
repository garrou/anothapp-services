import CatalogRepository from "../../repositories/catalogRepository.js";

const CATALOG_SIZE_HISTORY_SYNC_DAY = 1; // Monday

/**
 * @returns {Promise<{shows: number, seasons: number, episodes: number, historyRecorded: boolean}>}
 */
const reportCatalogSize = async () => {
    const catalogRepository = new CatalogRepository();
    const counts = await catalogRepository.getCounts();
    const historyRecorded = new Date().getDay() === CATALOG_SIZE_HISTORY_SYNC_DAY;

    if (historyRecorded) {
        await catalogRepository.recordSizeSnapshot(counts);
    }
    return {...counts, historyRecorded};
};

export default reportCatalogSize;
