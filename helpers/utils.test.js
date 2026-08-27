import { describe, it, expect } from "vitest";
import { frenchMonth } from "./utils.js";

describe("frenchMonth", () => {
    it("translates a month number to its French name", () => {
        expect(frenchMonth(1)).toBe("Janvier");
        expect(frenchMonth(8)).toBe("Août");
        expect(frenchMonth(12)).toBe("Décembre");
    });

    it("accepts a numeric string, as returned by pg aggregates", () => {
        expect(frenchMonth("8")).toBe("Août");
    });

    it("returns an empty string for an out-of-range month", () => {
        expect(frenchMonth(0)).toBe("");
        expect(frenchMonth(13)).toBe("");
    });
});
