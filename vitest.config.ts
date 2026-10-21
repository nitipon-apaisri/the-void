import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{client,server,desktop,shared}/src/**/test/*.spec.ts", "test/**/*.spec.ts"],
    exclude: ["test/load/**"],
  },
});
