import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // *.pg.test.js files hit a real Postgres (see vitest.pg.config.js / npm run test:pg) - keep them
    // out of this fast, fully-mocked default suite.
    exclude: [
      "**/node_modules/**", "**/dist/**", "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/*.pg.test.js",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});