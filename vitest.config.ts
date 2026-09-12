import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.ts: that config wires up the
// CRXJS plugin for building the actual extension bundle, which isn't
// relevant (and doesn't play nicely) with running unit tests.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
