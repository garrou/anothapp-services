import { describe, it, expect, vi, beforeEach } from "vitest";

const transporterMocks = vi.hoisted(() => ({ sendMail: vi.fn() }));
const eventBusMocks = vi.hoisted(() => ({ emit: vi.fn() }));
let mockTransporter = null;

vi.mock("../../../helpers/eventBus.js", () => ({ default: eventBusMocks }));

// config/mailer.js exports a single value decided once at import time (null, or a real
// transporter, depending on EMAIL_HOST) - re-mock it per test via vi.doMock + a fresh dynamic
// import, since a static import can't be swapped between "configured" and "not configured".
const importMailerService = async () => {
    vi.resetModules();
    vi.doMock("../../../config/mailer.js", () => ({ default: mockTransporter }));
    return (await import("../../../services/mailerService.js")).default;
}

describe("MailerService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTransporter = null;
    });

    it("does not attempt to send when no transporter is configured (EMAIL_HOST unset)", async () => {
        const MailerService = await importMailerService();
        const service = new MailerService();

        await expect(service.sendVerificationEmail("a@b.com", "https://x/verify")).resolves.toBeUndefined();
        expect(eventBusMocks.emit).not.toHaveBeenCalled();
    });

    it("sends a verification email through the transporter when configured", async () => {
        mockTransporter = transporterMocks;
        process.env.EMAIL_FROM = "noreply@anothapp.fr";
        const MailerService = await importMailerService();
        const service = new MailerService();

        await service.sendVerificationEmail("a@b.com", "https://x/verify-email/tok");

        expect(transporterMocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            from: "noreply@anothapp.fr",
            to: "a@b.com",
            subject: expect.stringContaining("Confirmez"),
            html: expect.stringContaining("https://x/verify-email/tok"),
        }));
        expect(eventBusMocks.emit).toHaveBeenCalledWith("mailer.sent");
    });

    it("sends a password-reset email through the transporter when configured", async () => {
        mockTransporter = transporterMocks;
        const MailerService = await importMailerService();
        const service = new MailerService();

        await service.sendPasswordResetEmail("a@b.com", "https://x/reset-password/tok");

        expect(transporterMocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            to: "a@b.com",
            subject: expect.stringContaining("Réinitialisation"),
            html: expect.stringContaining("https://x/reset-password/tok"),
        }));
    });

    it("propagates a real send failure instead of swallowing it", async () => {
        mockTransporter = transporterMocks;
        transporterMocks.sendMail.mockRejectedValue(new Error("SMTP down"));
        const MailerService = await importMailerService();
        const service = new MailerService();

        await expect(service.sendVerificationEmail("a@b.com", "https://x/verify")).rejects.toThrow("SMTP down");
    });
});
