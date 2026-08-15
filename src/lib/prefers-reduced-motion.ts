/**
 * Whether the user has asked the system to reduce motion.
 *
 * Guarded on `matchMedia` existing so it is safe to call during a render
 * that also runs on the server, and read at call time rather than cached:
 * the setting can change while the page is open.
 */
export const prefersReducedMotion = () =>
  typeof globalThis.matchMedia === "function" &&
  globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
