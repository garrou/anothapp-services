import {describe, it, expect, vi, beforeEach} from "vitest";
import HttpClient from "./httpClient.js";

const axiosMocks = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
}));

vi.mock("axios", () => ({default: axiosMocks}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("HttpClient.get", () => {
    it("returns the parsed response body", async () => {
        axiosMocks.get.mockResolvedValue({data: {id: 1}});

        const result = await HttpClient.get("https://example.com", {"X-Key": "abc"});

        expect(axiosMocks.get).toHaveBeenCalledWith("https://example.com", {headers: {"X-Key": "abc"}});
        expect(result).toEqual({id: 1});
    });

    it("defaults to no headers", async () => {
        axiosMocks.get.mockResolvedValue({data: {}});

        await HttpClient.get("https://example.com");

        expect(axiosMocks.get).toHaveBeenCalledWith("https://example.com", {headers: {}});
    });
});

describe("HttpClient.post", () => {
    it("returns the parsed response body", async () => {
        axiosMocks.post.mockResolvedValue({data: {ok: true}});

        const result = await HttpClient.post("https://example.com", {foo: "bar"});

        expect(axiosMocks.post).toHaveBeenCalledWith("https://example.com", {foo: "bar"});
        expect(result).toEqual({ok: true});
    });
});
