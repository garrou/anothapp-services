import UserRepository from "../repositories/userRepository.js";
import RefreshTokenRepository from "../repositories/refreshTokenRepository.js";
import DatabaseRepository from "../repositories/databaseRepository.js";
import AdminRepository from "../repositories/adminRepository.js";
import AdminActionRepository from "../repositories/adminActionRepository.js";
import HealthService from "./healthService.js";

const NEW_USERS_WINDOW_DAYS = 14;
const SUSPICIOUS_LOGIN_WINDOW_DAYS = 1;
const SEARCH_RESULTS_LIMIT = 10;
const RECENT_ACTIONS_LIMIT = 50;

export const ADMIN_ACTION_REVOKE_SESSIONS = "revoke_sessions";

export default class AdminService {
    constructor() {
        this._userRepository = new UserRepository();
        this._refreshTokenRepository = new RefreshTokenRepository();
        this._databaseRepository = new DatabaseRepository();
        this._adminRepository = new AdminRepository();
        this._adminActionRepository = new AdminActionRepository();
        this._healthService = new HealthService();
    }

    /**
     * @returns {Promise<Object>}
     */
    getDashboard = async () => {
        const [
            userCount, databaseSize, newUsersByDay, pendingDeletions, anonymizedAccounts,
            activeSessions, suspiciousLogins, recentActions, health,
        ] = await Promise.all([
            this._userRepository.getUserCount(),
            this._databaseRepository.getDatabaseSize(),
            this._adminRepository.getNewUsersByDay(NEW_USERS_WINDOW_DAYS),
            this._adminRepository.getPendingDeletionsCount(),
            this._adminRepository.getAnonymizedCount(),
            this._adminRepository.getActiveSessionsCount(),
            this._adminRepository.getSuspiciousLoginActivity(SUSPICIOUS_LOGIN_WINDOW_DAYS),
            this._adminActionRepository.getRecent(RECENT_ACTIONS_LIMIT),
            this._healthService.check(),
        ]);
        return {
            userCount, databaseSize, newUsersByDay, pendingDeletions, anonymizedAccounts,
            activeSessions, suspiciousLogins, recentActions, health,
        };
    }

    /**
     * @param {string?} query
     * @returns {Promise<{id: string, username: string, email: string}[]>}
     */
    searchUsers = async (query) => {
        if (!query || query.length < 2) {
            return [];
        }
        return this._adminRepository.searchUsers(query, SEARCH_RESULTS_LIMIT);
    }

    /**
     * @param {string} adminUserId
     * @param {string} targetUserId
     * @returns {Promise<{revokedCount: number}>}
     */
    revokeUserSessions = async (adminUserId, targetUserId) => {
        const revokedCount = await this._refreshTokenRepository.revokeAllForUser(targetUserId);
        await this._adminActionRepository.create(adminUserId, ADMIN_ACTION_REVOKE_SESSIONS, targetUserId);
        return { revokedCount };
    }
}
