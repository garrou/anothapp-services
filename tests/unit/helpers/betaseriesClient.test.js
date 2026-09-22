import { describe, it, expect, vi, beforeEach } from "vitest";
import BetaseriesClient from "../../../helpers/betaseriesClient.js";
import HttpClient from "../../../helpers/httpClient.js";

const eventBusMocks = vi.hoisted(() => ({ emit: vi.fn() }));

vi.mock("../../../helpers/httpClient.js", () => ({
    default: { get: vi.fn() },
}));
vi.mock("../../../helpers/eventBus.js", () => ({ default: eventBusMocks }));

describe("BetaseriesClient.get", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("emits a betaseries.called event for every call, and returns the response body", async () => {
        HttpClient.get.mockResolvedValue({ show: { id: 1 } });
        const client = new BetaseriesClient("key");

        const result = await client.get("/shows/display?id=1", 5000);

        expect(eventBusMocks.emit).toHaveBeenCalledWith("betaseries.called");
        expect(HttpClient.get).toHaveBeenCalledWith(
            "https://api.betaseries.com/shows/display?id=1", { "X-BetaSeries-Key": "key" }, 5000
        );
        expect(result).toEqual({ show: { id: 1 } });
    });

    it("still emits when the call ends up failing", async () => {
        HttpClient.get.mockRejectedValue(new Error("timeout"));
        const client = new BetaseriesClient("key");

        await expect(client.get("/shows/display?id=1")).rejects.toThrow("timeout");

        expect(eventBusMocks.emit).toHaveBeenCalledWith("betaseries.called");
    });
});
