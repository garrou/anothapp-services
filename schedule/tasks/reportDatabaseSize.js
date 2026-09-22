import DatabaseRepository from "../../repositories/databaseRepository.js";

const DATABASE_SIZE_HISTORY_SYNC_DAY = 1; // Monday

/**
 * @returns {Promise<{size: string, historyRecorded: boolean}>}
 */
const reportDatabaseSize = async () => {
    const databaseRepository = new DatabaseRepository();
    const size = await databaseRepository.getDatabaseSize();
    const historyRecorded = new Date().getDay() === DATABASE_SIZE_HISTORY_SYNC_DAY;

    if (historyRecorded) {
        const sizeBytes = await databaseRepository.getDatabaseSizeBytes();
        await databaseRepository.recordSizeSnapshot(sizeBytes);
    }
    return {size, historyRecorded};
};

export default reportDatabaseSize;
