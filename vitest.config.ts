import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // The real `server-only` entry throws unless the bundler is under the
      // `react-server` condition, which Next.js sets and Vitest does not.
      // It is a build-time marker with no runtime behaviour, so tests swap in
      // a no-op. The guard still fires for real in `npm run build`.
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    // Suites needing a DOM (React hooks, components) opt in with a
    // `@vitest-environment jsdom` docblock; the rest stay in node.
  },
})
