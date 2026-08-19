import { describe, it, expect, vi, beforeEach } from "vitest";
import EpisodeService from "./episodeService.js";

const episodeRepoMocks = vi.hoisted(() => ({
    deleteEpisodeById: vi.fn(),
}));

vi.mock("../repositories/episodeRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return episodeRepoMocks; }),
}));

describe("EpisodeService.deleteByEpisodeId", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("rejects with a 400 when no episodeId is given", async () => {
        await expect(episodeService.deleteByEpisodeId("user-1", undefined)).rejects.toThrow(
            "Requête invalide"
        );
        expect(episodeRepoMocks.deleteEpisodeById).not.toHaveBeenCalled();
    });

    it("deletes the episode when it exists", async () => {
        episodeRepoMocks.deleteEpisodeById.mockResolvedValue(true);

        await expect(episodeService.deleteByEpisodeId("user-1", 7)).resolves.toBeUndefined();
        expect(episodeRepoMocks.deleteEpisodeById).toHaveBeenCalledWith("user-1", 7);
    });

    it("throws a 500 when nothing was deleted", async () => {
        episodeRepoMocks.deleteEpisodeById.mockResolvedValue(false);

        await expect(episodeService.deleteByEpisodeId("user-1", 7)).rejects.toThrow(
            "Impossible de supprimer l'épisode"
        );
    });
});
