import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{js,mjs}"],
    coverage: {
      provider: "v8",
      include: ["public/app/**/*.js"],
      exclude: ["public/app/dev/**"],
    },
  },
});
