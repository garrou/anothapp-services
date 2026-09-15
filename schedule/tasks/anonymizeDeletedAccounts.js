import UserRepository from "../../repositories/userRepository.js";
import { DELETION_GRACE_DAYS } from "../../constants/deletion.js";

/**
 * @returns {Promise<{anonymized: number}>}
 */
const anonymizeDeletedAccounts = async () => {
    const userRepository = new UserRepository();
    const anonymized = await userRepository.anonymizeEligibleAccounts(DELETION_GRACE_DAYS);
    return {anonymized};
};

export default anonymizeDeletedAccounts;
