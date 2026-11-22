import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup-env.ts"],
    // Tests share one in-memory MongoDB; run files one after another.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
