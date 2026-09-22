import { describe, it, expect, vi, beforeEach } from "vitest";
import eventBus from "../../../helpers/eventBus.js";
import AdminListener from "../../../services/adminListener.js";

const serviceCallCountRepoMocks = vi.hoisted(() => ({
    increment: vi.fn(),
}));

vi.mock("../../../repositories/serviceCallCountRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return serviceCallCountRepoMocks; }),
}));

// eventBus.emit() fires listeners as detached microtasks (see helpers/eventBus.js)
// so a listener's async work needs a tick to run before we can assert on it.
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("AdminListener", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        eventBus.removeAllListeners();
        new AdminListener();
    });

    it("counts a sent email against the mailer service", async () => {
        eventBus.emit("mailer.sent");
        await flush();

        expect(serviceCallCountRepoMocks.increment).toHaveBeenCalledWith("mailer");
    });

    it("counts a BetaSeries call", async () => {
        eventBus.emit("betaseries.called");
        await flush();

        expect(serviceCallCountRepoMocks.increment).toHaveBeenCalledWith("betaseries");
    });

    it("counts a data export request", async () => {
        eventBus.emit("settings.exported");
        await flush();

        expect(serviceCallCountRepoMocks.increment).toHaveBeenCalledWith("export");
    });

    it("counts a data import request", async () => {
        eventBus.emit("settings.imported");
        await flush();

        expect(serviceCallCountRepoMocks.increment).toHaveBeenCalledWith("import");
    });

    it("a listener failure is isolated and does not throw back into the emitter", async () => {
        serviceCallCountRepoMocks.increment.mockRejectedValue(new Error("db down"));

        expect(() => eventBus.emit("mailer.sent")).not.toThrow();
        await flush();
    });
});
