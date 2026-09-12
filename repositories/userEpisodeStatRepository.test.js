import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import UserEpisodeStatRepository from "./userEpisodeStatRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("UserEpisodeStatRepository", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserEpisodeStatRepository();
    });

    describe("getTotalTimeByUserId", () => {
        it("returns the parsed total time", async () => {
            db.query.mockResolvedValue({rows: [{time: "120"}]});

            const result = await repo.getTotalTimeByUserId("user-1");

            expect(result).toBe(120);
        });

        it("returns 0 when there is no data", async () => {
            db.query.mockResolvedValue({rows: [{time: null}]});

            const result = await repo.getTotalTimeByUserId("user-1");

            expect(result).toBe(0);
        });
    });

    describe("getTimeCurrentMonthByUserId", () => {
        it("returns the parsed time", async () => {
            db.query.mockResolvedValue({rows: [{time: "60"}]});

            const result = await repo.getTimeCurrentMonthByUserId("user-1");

            expect(result).toBe(60);
        });

        it("returns 0 when there is no data", async () => {
            db.query.mockResolvedValue({rows: [{time: null}]});

            const result = await repo.getTimeCurrentMonthByUserId("user-1");

            expect(result).toBe(0);
        });
    });

    describe("getTimeCurrentMonthByUserIds", () => {
        it("returns an empty Map without querying when userIds is empty", async () => {
            const result = await repo.getTimeCurrentMonthByUserIds([]);

            expect(db.query).not.toHaveBeenCalled();
            expect(result.size).toBe(0);
        });

        it("returns a Map keyed by user id", async () => {
            db.query.mockResolvedValue({rows: [{user_id: "user-1", time: "60"}]});

            const result = await repo.getTimeCurrentMonthByUserIds(["user-1"]);

            expect(result.get("user-1")).toBe(60);
        });
    });

    describe("getTimeHourByUserIdGroupByYear", () => {
        it("maps rows to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{label: "2024", value: "10"}]});

            const result = await repo.getTimeHourByUserIdGroupByYear("user-1");

            expect(result).toEqual([{id: 0, label: "2024", value: 10}]);
        });
    });

    describe("getRecordViewingTimeMonth", () => {
        it("reverses the rows and maps to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{label: "02/2024", value: "50"}, {label: "01/2024", value: "100"}]});

            const result = await repo.getRecordViewingTimeMonth("user-1");

            expect(result).toEqual([{id: 0, label: "01/2024", value: 100}, {id: 0, label: "02/2024", value: 50}]);
        });

        it("uses the provided limit", async () => {
            db.query.mockResolvedValue({rows: []});

            await repo.getRecordViewingTimeMonth("user-1", 5);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 5]);
        });
    });

    describe("getRankingViewingTimeByShows", () => {
        it("maps rows to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{label: "Show", value: "42"}]});

            const result = await repo.getRankingViewingTimeByShows("user-1");

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 10]);
            expect(result).toEqual([{id: 0, label: "Show", value: 42}]);
        });
    });

    describe("getTotalEpisodesByUserId", () => {
        it("returns the parsed total", async () => {
            db.query.mockResolvedValue({rows: [{total: "5"}]});

            const result = await repo.getTotalEpisodesByUserId("user-1");

            expect(result).toBe(5);
        });
    });

    describe("getNbEpisodesByUserIdGroupByYear", () => {
        it("maps rows to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{label: "2024", value: "3"}]});

            const result = await repo.getNbEpisodesByUserIdGroupByYear("user-1");

            expect(result).toEqual([{id: 0, label: "2024", value: 3}]);
        });
    });

    describe("getNbEpisodesByUserIdGroupByMonthByCurrentYear", () => {
        it("maps rows to Stat instances with french month labels", async () => {
            db.query.mockResolvedValue({rows: [{num: "1", value: "4"}]});

            const result = await repo.getNbEpisodesByUserIdGroupByMonthByCurrentYear("user-1");

            expect(result).toEqual([{id: 0, label: "Janvier", value: 4}]);
        });
    });

    describe("getTotalTimeByUserIdByYear", () => {
        it("returns the parsed time", async () => {
            db.query.mockResolvedValue({rows: [{time: "90"}]});

            const result = await repo.getTotalTimeByUserIdByYear("user-1", 2024);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 2024]);
            expect(result).toBe(90);
        });
    });

    describe("getTotalEpisodesByUserIdByYear", () => {
        it("returns the parsed total", async () => {
            db.query.mockResolvedValue({rows: [{total: "8"}]});

            const result = await repo.getTotalEpisodesByUserIdByYear("user-1", 2024);

            expect(result).toBe(8);
        });
    });

    describe("getTopShowByUserIdByYear", () => {
        it("returns a Stat when found", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{label: "Show", value: "500"}]});

            const result = await repo.getTopShowByUserIdByYear("user-1", 2024);

            expect(result).toEqual({id: 0, label: "Show", value: 500});
        });

        it("returns null when nothing matched", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.getTopShowByUserIdByYear("user-1", 2024);

            expect(result).toBeNull();
        });
    });

    describe("getKindsTimeByUserIdByYear", () => {
        it("returns a Stat when found", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{label: "Drame", value: "300"}]});

            const result = await repo.getKindsTimeByUserIdByYear("user-1", 2024);

            expect(result).toEqual({id: 0, label: "Drame", value: 300});
        });

        it("returns null when nothing matched", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.getKindsTimeByUserIdByYear("user-1", 2024);

            expect(result).toBeNull();
        });
    });

    describe("getTopPlatformByUserIdByYear", () => {
        it("returns a Stat when found", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{label: "Netflix", value: "12"}]});

            const result = await repo.getTopPlatformByUserIdByYear("user-1", 2024);

            expect(result).toEqual({id: 0, label: "Netflix", value: 12});
        });

        it("returns null when nothing matched", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.getTopPlatformByUserIdByYear("user-1", 2024);

            expect(result).toBeNull();
        });
    });

    describe("getBestMonthByUserIdByYear", () => {
        it("returns a Stat with the french month label when found", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{num: "3", value: "200"}]});

            const result = await repo.getBestMonthByUserIdByYear("user-1", 2024);

            expect(result).toEqual({id: 0, label: "Mars", value: 200});
        });

        it("returns null when nothing matched", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.getBestMonthByUserIdByYear("user-1", 2024);

            expect(result).toBeNull();
        });
    });

    describe("getWatchedDatesByUserId", () => {
        it("returns the list of dates", async () => {
            db.query.mockResolvedValue({rows: [{date: "2024-01-01"}]});

            const result = await repo.getWatchedDatesByUserId("user-1");

            expect(result).toEqual(["2024-01-01"]);
        });
    });

    describe("getWatchedDatesByUserIdByYear", () => {
        it("returns the list of dates", async () => {
            db.query.mockResolvedValue({rows: [{date: "2024-01-01"}]});

            const result = await repo.getWatchedDatesByUserIdByYear("user-1", 2024);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 2024]);
            expect(result).toEqual(["2024-01-01"]);
        });
    });

    describe("getWatchedByDay", () => {
        it("returns date/value pairs with the value parsed", async () => {
            db.query.mockResolvedValue({rows: [{date: "2024-01-01", value: "3"}]});

            const result = await repo.getWatchedByDay("user-1");

            expect(result).toEqual([{date: "2024-01-01", value: 3}]);
        });
    });
});
