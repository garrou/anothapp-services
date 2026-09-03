import { describe, it, expect } from "vitest";
import { frenchMonth, isOwnRequest } from "./utils.js";

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

describe("isOwnRequest", () => {
    it("is true when no id is requested", () => {
        expect(isOwnRequest("user-1", undefined)).toBe(true);
    });

    it("is true when the requested id is the caller's own", () => {
        expect(isOwnRequest("user-1", "user-1")).toBe(true);
    });

    it("is false when the requested id belongs to someone else", () => {
        expect(isOwnRequest("user-1", "user-2")).toBe(false);
    });
});
