import LoginChallengeRepository from "../../repositories/loginChallengeRepository.js";

const LOGIN_CHALLENGE_RETENTION_DAYS = parseInt(process.env.LOGIN_CHALLENGE_RETENTION_DAYS ?? "7", 10);

/**
 * @returns {Promise<{deleted: number}>}
 */
const cleanupLoginChallenges = async () => {
    const loginChallengeRepository = new LoginChallengeRepository();
    const deleted = await loginChallengeRepository.deleteOlderThanDays(LOGIN_CHALLENGE_RETENTION_DAYS);
    return {deleted};
};

export default cleanupLoginChallenges;
