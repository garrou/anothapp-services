import UserRepository from "../../repositories/userRepository.js";

const DELETION_GRACE_DAYS = 15;

/**
 * @returns {Promise<{anonymized: number}>}
 */
const anonymizeDeletedAccounts = async () => {
    const userRepository = new UserRepository();
    const anonymized = await userRepository.anonymizeEligibleAccounts(DELETION_GRACE_DAYS);
    return {anonymized};
};

export default anonymizeDeletedAccounts;
