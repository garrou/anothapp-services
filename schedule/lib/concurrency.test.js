import {describe, expect, it} from "vitest";
import mapWithConcurrency from "./concurrency.js";

describe("mapWithConcurrency", () => {
    it("resolves every item in its original order", async () => {
        const items = [1, 2, 3, 4, 5];
        const results = await mapWithConcurrency(items, 2, async (item) => item * 2);

        expect(results.map((r) => r.value)).toEqual([2, 4, 6, 8, 10]);
        expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    });

    it("never runs more than `limit` calls at once", async () => {
        let inFlight = 0;
        let maxInFlight = 0;
        const items = new Array(10).fill(0);

        await mapWithConcurrency(items, 3, async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 5));
            inFlight -= 1;
        });
        expect(maxInFlight).toBeLessThanOrEqual(3);
    });

    it("reports a rejection without aborting the other items", async () => {
        const items = [1, 2, 3];
        const results = await mapWithConcurrency(items, 3, async (item) => {
            if (item === 2) throw new Error("boom");
            return item;
        });

        expect(results[0]).toEqual({status: "fulfilled", value: 1});
        expect(results[1].status).toBe("rejected");
        expect(results[1].reason.message).toBe("boom");
        expect(results[2]).toEqual({status: "fulfilled", value: 3});
    });

    it("handles an empty list", async () => {
        const results = await mapWithConcurrency([], 5, async (item) => item);
        expect(results).toEqual([]);
    });
});
