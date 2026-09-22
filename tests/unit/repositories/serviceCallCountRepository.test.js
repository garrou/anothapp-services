import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../../../config/db.js";
import ServiceCallCountRepository from "../../../repositories/serviceCallCountRepository.js";

vi.mock("../../../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("ServiceCallCountRepository.increment", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ServiceCallCountRepository();
    });

    it("upserts today's counter for the given service", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.increment("mailer");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT (service, day) DO UPDATE"), ["mailer"]);
    });
});

describe("ServiceCallCountRepository.getAll", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ServiceCallCountRepository();
    });

    it("returns every known service with a zero total and empty history by default", async () => {
        db.query.mockResolvedValue({rows: []});

        const result = await repo.getAll();

        expect(result).toEqual({
            mailer: {total: 0, history: []},
            betaseries: {total: 0, history: []},
            export: {total: 0, history: []},
            import: {total: 0, history: []},
        });
    });

    it("fills in the lifetime total and the daily history per service", async () => {
        db.query
            .mockResolvedValueOnce({rows: [{service: "mailer", total: "42"}, {service: "betaseries", total: "500"}]})
            .mockResolvedValueOnce({
                rows: [
                    {service: "mailer", day: "2024-01-01", count: "10"},
                    {service: "mailer", day: "2024-01-02", count: "32"},
                    {service: "betaseries", day: "2024-01-01", count: "500"},
                ],
            });

        const result = await repo.getAll(30);

        expect(db.query).toHaveBeenLastCalledWith(expect.any(String), [30]);
        expect(result.mailer).toEqual({
            total: 42,
            history: [{day: "2024-01-01", count: 10}, {day: "2024-01-02", count: 32}],
        });
        expect(result.betaseries).toEqual({total: 500, history: [{day: "2024-01-01", count: 500}]});
        expect(result.export).toEqual({total: 0, history: []});
    });
});
