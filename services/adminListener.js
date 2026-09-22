import eventBus from "../helpers/eventBus.js";
import ServiceCallCountRepository from "../repositories/serviceCallCountRepository.js";

export const SERVICE_CALL_MAILER = "mailer";
export const SERVICE_CALL_BETASERIES = "betaseries";
export const SERVICE_CALL_EXPORT = "export";
export const SERVICE_CALL_IMPORT = "import";

export default class AdminListener {

    constructor() {
        this._serviceCallCountRepository = new ServiceCallCountRepository();
        this.#register();
    }

    #register = () => {
        eventBus.on("mailer.sent", this.#increment(SERVICE_CALL_MAILER));
        eventBus.on("betaseries.called", this.#increment(SERVICE_CALL_BETASERIES));
        eventBus.on("settings.exported", this.#increment(SERVICE_CALL_EXPORT));
        eventBus.on("settings.imported", this.#increment(SERVICE_CALL_IMPORT));
    }

    /**
     * @param {string} service
     * @returns {() => Promise<void>}
     */
    #increment = (service) => () => this._serviceCallCountRepository.increment(service);
}
