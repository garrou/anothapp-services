import {describe, it, expect} from "vitest";
import createCache from "../../../helpers/cacheClient.js";

describe("createCache", () => {
    it("returns a working cache instance configured with the given options", () => {
        const cache = createCache({stdTTL: 60});

        cache.set("key", "value");

        expect(cache.get("key")).toBe("value");
    });
});
