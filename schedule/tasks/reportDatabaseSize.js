import DatabaseRepository from "../../repositories/databaseRepository.js";

/**
 * @returns {Promise<{size: string}>}
 */
const reportDatabaseSize = async () => {
    const databaseRepository = new DatabaseRepository();
    const size = await databaseRepository.getDatabaseSize();
    return {size};
};

export default reportDatabaseSize;
