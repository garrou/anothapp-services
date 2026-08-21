import {describe, it, expect, vi, beforeEach} from "vitest";
import sendTelegramMessage, {shorten} from "./notify.js";

const axiosMocks = vi.hoisted(() => ({
    post: vi.fn(),
}));

vi.mock("axios", () => ({default: axiosMocks}));

describe("shorten", () => {
    it("returns the message unchanged when it already fits", () => {
        expect(shorten("2 série(s) mise(s) à jour\n    [1 - Show]")).toBe("2 série(s) mise(s) à jour\n    [1 - Show]");
    });

    it("drops the indented detail lines when the message is too long", () => {
        const detail = "    [1 - Show]\n".repeat(500);
        const message = `500 série(s) mise(s) à jour\n${detail}0 série(s) supprimée(s)`;

        const result = shorten(message);

        expect(result.length).toBeLessThanOrEqual(4096);
        expect(result).toBe("500 série(s) mise(s) à jour\n0 série(s) supprimée(s)");
    });

    it("hard-truncates as a last resort when even the summary is too long", () => {
        const message = "x".repeat(5000);

        const result = shorten(message);

        expect(result.length).toBe(4096);
        expect(result.endsWith("…")).toBe(true);
    });
});

describe("sendTelegramMessage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.TELEGRAM_TOKEN = "token";
        process.env.TELEGRAM_CHAT_ID = "chat-id";
    });

    it("skips sending when TELEGRAM_TOKEN or TELEGRAM_CHAT_ID is missing", async () => {
        delete process.env.TELEGRAM_TOKEN;

        await sendTelegramMessage("hello");

        expect(axiosMocks.post).not.toHaveBeenCalled();
    });

    it("sends the (possibly shortened) message", async () => {
        axiosMocks.post.mockResolvedValue({});

        await sendTelegramMessage("hello");

        expect(axiosMocks.post).toHaveBeenCalledWith(
            "https://api.telegram.org/bottoken/sendMessage",
            {chat_id: "chat-id", text: "hello"}
        );
    });

    it("does not throw when Telegram rejects the request", async () => {
        axiosMocks.post.mockRejectedValue({
            response: {data: {ok: false, error_code: 400, description: "Bad Request: message is too long"}},
        });

        await expect(sendTelegramMessage("hello")).resolves.toBeUndefined();
    });
});
