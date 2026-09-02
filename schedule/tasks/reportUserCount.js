import UserRepository from "../../repositories/userRepository.js";

/**
 * @returns {Promise<{total: number}>}
 */
const reportUserCount = async () => {
    const userRepository = new UserRepository();
    const total = await userRepository.getUserCount();
    return {total};
};

export default reportUserCount;
