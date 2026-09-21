import { describe, it, expect, vi, beforeEach } from "vitest";
import HealthService from "../../../services/healthService.js";

const betaseriesGetMock = vi.hoisted(() => vi.fn());
const transporterMock = vi.hoisted(() => ({ verify: vi.fn() }));
let mockTransporter = null;

vi.mock("../../../helpers/betaseriesClient.js", () => ({
    default: vi.fn().mockImplementation(function () { return { get: betaseriesGetMock }; }),
}));
vi.mock("../../../config/mailer.js", () => ({
    get default() { return mockTransporter; },
}));

describe("HealthService.checkBetaseries", () => {
    let service;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new HealthService();
    });

    it("reports reachable with a latency when the call succeeds", async () => {
        betaseriesGetMock.mockResolvedValue({ genres: {} });

        const result = await service.checkBetaseries();

        expect(result.reachable).toBe(true);
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
        expect(result.error).toBeUndefined();
    });

    it("reports unreachable with an error message when the call fails", async () => {
        betaseriesGetMock.mockRejectedValue(new Error("timeout of 5000ms exceeded"));

        const result = await service.checkBetaseries();

        expect(result.reachable).toBe(false);
        expect(result.error).toContain("timeout");
    });
});

describe("HealthService.checkMailer", () => {
    let service;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new HealthService();
    });

    it("reports not configured when EMAIL_HOST isn't set (transporter is null)", async () => {
        mockTransporter = null;

        const result = await service.checkMailer();

        expect(result).toEqual({ configured: false, reachable: false });
    });

    it("reports reachable when the SMTP transporter verifies", async () => {
        mockTransporter = transporterMock;
        transporterMock.verify.mockResolvedValue(true);

        const result = await service.checkMailer();

        expect(result.configured).toBe(true);
        expect(result.reachable).toBe(true);
    });

    it("reports configured but unreachable when verify() fails", async () => {
        mockTransporter = transporterMock;
        transporterMock.verify.mockRejectedValue(new Error("ECONNREFUSED"));

        const result = await service.checkMailer();

        expect(result).toMatchObject({ configured: true, reachable: false });
        expect(result.error).toContain("ECONNREFUSED");
    });
});

describe("HealthService.check", () => {
    it("combines both checks", async () => {
        mockTransporter = null;
        betaseriesGetMock.mockResolvedValue({});
        const service = new HealthService();

        const result = await service.check();

        expect(result.betaseries.reachable).toBe(true);
        expect(result.mailer).toEqual({ configured: false, reachable: false });
    });
});
