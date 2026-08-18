import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The module state two components share without a provider between them.
 *
 * `UnsavedGuard` and `GuardedLink` sit on opposite sides of the tree — one in
 * the header, one at the bottom of the viewport — and this module is what
 * connects them. Both halves are plain state with subscribers and no DOM, so
 * the decisions are checkable here even though neither component is.
 *
 * Re-imported per test rather than reset by hand: the state is module-level
 * by design, and a test that had to remember to clear it would be the first
 * thing to rot.
 */
async function fresh() {
  vi.resetModules();
  return await import("./unsaved");
}

describe("which rows are dirty", () => {
  let mod: Awaited<ReturnType<typeof fresh>>;

  beforeEach(async () => {
    mod = await fresh();
  });

  it("is false until a row says otherwise", () => {
    expect(mod.hasUnsaved()).toBe(false);
  });

  it("stays true while any single row is still dirty", () => {
    mod.setUnsaved("a", true);
    mod.setUnsaved("b", true);
    mod.setUnsaved("a", false);

    /*
     * The reason this is a set and not a boolean. Saving one row must not
     * disarm the guard for another that is still holding typed text.
     */
    expect(mod.hasUnsaved()).toBe(true);
    mod.setUnsaved("b", false);
    expect(mod.hasUnsaved()).toBe(false);
  });

  it("tells watchers only when the answer changes", () => {
    const watcher = vi.fn();
    mod.watchUnsaved(watcher);

    /*
     * This runs on every keystroke. A watcher woken per character would
     * re-render the page's guard on every letter somebody types.
     */
    mod.setUnsaved("a", true);
    mod.setUnsaved("a", true);
    mod.setUnsaved("b", true);
    expect(watcher).toHaveBeenCalledTimes(1);

    mod.setUnsaved("a", false);
    expect(watcher).toHaveBeenCalledTimes(1);
    mod.setUnsaved("b", false);
    expect(watcher).toHaveBeenCalledTimes(2);
  });

  it("stops telling a watcher that has unsubscribed", () => {
    const watcher = vi.fn();
    const stop = mod.watchUnsaved(watcher);
    stop();

    mod.setUnsaved("a", true);
    expect(watcher).not.toHaveBeenCalled();
  });
});

describe("where somebody tried to go", () => {
  let mod: Awaited<ReturnType<typeof fresh>>;

  beforeEach(async () => {
    mod = await fresh();
  });

  it("holds nothing until a link cancels itself", () => {
    expect(mod.pendingExit()).toBeNull();
  });

  it("keeps the destination and wakes the guard", () => {
    const watcher = vi.fn();
    mod.watchPendingExit(watcher);

    mod.askBeforeLeaving("/contribute/invite");

    expect(mod.pendingExit()).toBe("/contribute/invite");
    expect(watcher).toHaveBeenCalledTimes(1);
  });

  it("keeps the second destination, not the first", () => {
    mod.askBeforeLeaving("/contribute/invite");
    mod.askBeforeLeaving("/contribute/admin");

    /*
     * Two blocked clicks is one person changing their mind, and the second
     * is the one they meant. A queue would send them somewhere they had
     * already decided against.
     */
    expect(mod.pendingExit()).toBe("/contribute/admin");
  });

  it("clears, and says so once", () => {
    const watcher = vi.fn();
    mod.watchPendingExit(watcher);

    mod.askBeforeLeaving("/contribute/admin");
    mod.clearPendingExit();
    expect(mod.pendingExit()).toBeNull();
    expect(watcher).toHaveBeenCalledTimes(2);

    /*
     * Escape, "Stay" and an unmount can all clear it, and the panel is
     * already gone after the first. A second notification would re-render
     * the guard to tell it nothing changed.
     */
    mod.clearPendingExit();
    expect(watcher).toHaveBeenCalledTimes(2);
  });
});
