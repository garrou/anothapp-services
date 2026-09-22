import db from "../config/db.js";
import UserRepository from "../repositories/userRepository.js";
import RefreshTokenRepository from "../repositories/refreshTokenRepository.js";
import DatabaseRepository from "../repositories/databaseRepository.js";
import AdminRepository from "../repositories/adminRepository.js";
import AdminActionRepository from "../repositories/adminActionRepository.js";
import ServiceCallCountRepository from "../repositories/serviceCallCountRepository.js";
import CatalogRepository from "../repositories/catalogRepository.js";
import HealthService from "./healthService.js";

const NEW_USERS_WINDOW_DAYS = 14;
const LOGIN_ATTEMPT_LIMIT_WINDOW_DAYS = 1;
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
        this._serviceCallCountRepository = new ServiceCallCountRepository();
        this._catalogRepository = new CatalogRepository();
        this._healthService = new HealthService();
    }

    /**
     * @returns {Promise<Object>}
     */
    getDashboard = async () => {
        const [
            userCount, databaseSize, databaseSizeHistory, catalogSizeHistory, newUsersByDay, pendingDeletions,
            anonymizedAccounts, activeSessions, loginAttemptLimit, recentActions, health, serviceCalls,
        ] = await Promise.all([
            this._userRepository.getUserCount(),
            this._databaseRepository.getDatabaseSize(),
            this._databaseRepository.getSizeHistory(),
            this._catalogRepository.getSizeHistory(),
            this._adminRepository.getNewUsersByDay(NEW_USERS_WINDOW_DAYS),
            this._adminRepository.getPendingDeletionsCount(),
            this._adminRepository.getAnonymizedCount(),
            this._adminRepository.getActiveSessionsCount(),
            this._adminRepository.getLoginChallengesReachingAttemptLimit(LOGIN_ATTEMPT_LIMIT_WINDOW_DAYS),
            this._adminActionRepository.getRecent(RECENT_ACTIONS_LIMIT),
            this._healthService.check(),
            this._serviceCallCountRepository.getAll(),
        ]);
        return {
            users: { total: userCount, newByDay: newUsersByDay, pendingDeletions, anonymized: anonymizedAccounts },
            sessions: { active: activeSessions, loginAttemptLimit },
            database: { size: databaseSize, history: databaseSizeHistory },
            catalog: { history: catalogSizeHistory },
            health,
            recentActions,
            serviceCalls,
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
        return db.transaction(async (client) => {
            const revokedCount = await this._refreshTokenRepository.revokeAllForUser(targetUserId, client);
            await this._adminActionRepository.create(adminUserId, ADMIN_ACTION_REVOKE_SESSIONS, targetUserId, client);
            return { revokedCount };
        });
    }
}
