import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Mocked tests live under tests/unit, mirroring the source tree. Real-Postgres tests
    // live under tests/pg (see vitest.pg.config.js / npm run test:pg) and are never part
    // of this fast, fully-mocked default suite.
    include: ["tests/unit/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});