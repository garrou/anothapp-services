import { EventEmitter } from "node:events";

class EventBus extends EventEmitter {
    emit(event, payload) {
        for (const listener of this.listeners(event)) {
            Promise.resolve()
                .then(() => listener(payload))
                .catch((err) => console.error(`[eventBus] listener for "${event}" failed:`, err));
        }
        return true;
    }
}

export default new EventBus();
