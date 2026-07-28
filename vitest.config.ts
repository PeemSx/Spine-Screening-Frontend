import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./", import.meta.url)),
      },
      {
        find: /^.*\.module\.css$/,
        replacement: fileURLToPath(
          new URL("./tests/styleModuleMock.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    clearMocks: true,
    css: false,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
});
