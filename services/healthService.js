import BetaseriesClient from "../helpers/betaseriesClient.js";
import transporter from "../config/mailer.js";
import { sanitizeErrorForLog } from "../helpers/utils.js";

const HEALTH_CHECK_TIMEOUT_MS = 5000;

export default class HealthService {
    constructor() {
        this._betaseriesClient = new BetaseriesClient();
    }

    /**
     * @returns {Promise<{reachable: boolean, latencyMs: number, error?: string}>}
     */
    checkBetaseries = async () => {
        const start = Date.now();

        try {
            // genres is a small, static list - about as cheap a real call as this API offers
            await this._betaseriesClient.get("/shows/genres", HEALTH_CHECK_TIMEOUT_MS);
            return { reachable: true, latencyMs: Date.now() - start };
        } catch (err) {
            return { reachable: false, latencyMs: Date.now() - start, error: sanitizeErrorForLog(err) };
        }
    }

    /**
     * @returns {Promise<{configured: boolean, reachable: boolean, latencyMs?: number, error?: string}>}
     */
    checkMailer = async () => {
        if (!transporter) {
            return { configured: false, reachable: false };
        }
        const start = Date.now();

        try {
            await transporter.verify();
            return { configured: true, reachable: true, latencyMs: Date.now() - start };
        } catch (err) {
            return { configured: true, reachable: false, latencyMs: Date.now() - start, error: sanitizeErrorForLog(err) };
        }
    }

    /**
     * @returns {Promise<{betaseries: Object, mailer: Object}>}
     */
    check = async () => {
        const [betaseries, mailer] = await Promise.all([this.checkBetaseries(), this.checkMailer()]);
        return { betaseries, mailer };
    }
}
