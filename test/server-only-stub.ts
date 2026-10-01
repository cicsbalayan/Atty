/**
 * Test stub for the `server-only` marker package.
 *
 * The real package resolves to a module that throws unless the bundler is
 * running under the `react-server` condition, which Next.js sets but Vitest
 * does not. The marker is a build-time guard for Client Component imports;
 * it has no runtime behaviour worth exercising, so tests alias it to this
 * no-op rather than reproducing the condition machinery.
 *
 * The guard is still real where it matters: `npm run build` runs through
 * Next.js and will fail if a Client Component ever imports `lib/auth/config`.
 */
export {}
