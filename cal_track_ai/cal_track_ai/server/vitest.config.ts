import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Prevents src/index.ts from binding a real port when it's imported by
    // tests (it only calls app.listen() when VERCEL is unset) — supertest
    // drives the Express app directly without a listening server.
    env: {
      VERCEL: "1",
    },
    testTimeout: 15000,
  },
});
