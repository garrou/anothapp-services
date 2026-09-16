import { defineConfig } from "vitest/config";

// Separate from vitest.config.js on purpose: these tests hit a real Postgres (docker-compose.test.yml
// locally, a service container in CI) instead of mocking db.query, so they must never run as part of
// the fast default `npm test` suite - only via `npm run test:pg`.
export default defineConfig({
    test: {
        include: ["tests/pg/**/*.pg.test.js"],
        environment: "node",
        globals: false,
        testTimeout: 15000,
        hookTimeout: 15000,
        // Serialized on purpose: every test shares one database and resets it with a TRUNCATE in
        // beforeEach, so two test files running at once would stomp on each other's fixtures.
        fileParallelism: false,
        env: {
            POSTGRES_USER: "test",
            POSTGRES_PASSWORD: "test",
            POSTGRES_DB: "anothapp_test",
            POSTGRES_HOST: "localhost",
            POSTGRES_PORT: "5433",
        },
    },
});
