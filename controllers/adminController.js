import AdminService from "../services/adminService.js";

export default class AdminController {
    constructor() {
        this._adminService = new AdminService();
    }

    /**
     * @returns {Promise<void>}
     */
    getDashboard = async (req, res, next) => {
        try {
            const dashboard = await this._adminService.getDashboard();
            res.status(200).json(dashboard);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    searchUsers = async (req, res, next) => {
        try {
            const { query } = req.query;
            const users = await this._adminService.searchUsers(query);
            res.status(200).json(users);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    revokeUserSessions = async (req, res, next) => {
        try {
            const { id } = req.params;
            const result = await this._adminService.revokeUserSessions(req.userId, id);
            res.status(200).json(result);
        } catch (e) {
            next(e);
        }
    }
}
