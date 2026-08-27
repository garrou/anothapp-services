import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeStreak } from "./streak.js";

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00Z"));
});

afterEach(() => {
    vi.useRealTimers();
});

describe("computeStreak", () => {
    it("returns zero for no watched days", () => {
        expect(computeStreak([])).toEqual({current: 0, longest: 0});
    });

    it("counts a run of consecutive days ending today", () => {
        expect(computeStreak(["2026-08-25", "2026-08-26", "2026-08-27"]))
            .toEqual({current: 3, longest: 3});
    });

    it("still counts the streak as active when the last day was yesterday", () => {
        expect(computeStreak(["2026-08-24", "2026-08-25", "2026-08-26"]))
            .toEqual({current: 3, longest: 3});
    });

    it("resets the current streak once more than a day has passed", () => {
        expect(computeStreak(["2026-08-20", "2026-08-21", "2026-08-22"]))
            .toEqual({current: 0, longest: 3});
    });

    it("keeps the longest run even after it was broken, while current tracks the trailing run", () => {
        expect(computeStreak(["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-26", "2026-08-27"]))
            .toEqual({current: 2, longest: 4});
    });

    it("ignores duplicate and unordered entries", () => {
        expect(computeStreak(["2026-08-27", "2026-08-25", "2026-08-26", "2026-08-26"]))
            .toEqual({current: 3, longest: 3});
    });
});
