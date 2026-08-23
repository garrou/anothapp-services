import RefreshTokenRepository from "../../repositories/refreshTokenRepository.js";

const REVOKED_RETENTION_DAYS = parseInt(process.env.REVOKED_TOKEN_RETENTION_DAYS ?? "7", 10);

/**
 * @returns {Promise<{deleted: number}>}
 */
const cleanupRefreshTokens = async () => {
    const refreshTokenRepository = new RefreshTokenRepository();
    const deleted = await refreshTokenRepository.deleteRevokedOlderThanDays(REVOKED_RETENTION_DAYS);
    return {deleted};
};

export default cleanupRefreshTokens;
