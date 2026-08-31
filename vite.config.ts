import react from "@vitejs/plugin-react"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    exclude: [
      ...configDefaults.exclude,
      "**/._*",
      "**/.superpowers/**",
      "**/tests/e2e/**",
    ],
  },
})
