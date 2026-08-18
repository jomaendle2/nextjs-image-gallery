"use client";

/**
 * Which rows are holding text that has not been saved.
 *
 * Module state rather than React state, and deliberately: the thing that has
 * to answer "is anything unsaved" is a `beforeunload` listener and a click
 * handler, neither of which is inside the tree. Threading a context from the
 * dashboard down through `PhotoList` → `PhotoCard` → `PhotoEditForm` and back
 * up to a listener at the top would be the same fact in two shapes.
 *
 * A `Set` of photo ids rather than a boolean, because rows are independent:
 * saving one must not clear the warning for another that is still dirty.
 */
const dirty = new Set<string>();

/** Told when the set becomes empty or non-empty, so a guard can attach. */
const watchers = new Set<() => void>();

export function watchUnsaved(onChange: () => void): () => void {
  watchers.add(onChange);
  return () => {
    watchers.delete(onChange);
  };
}

export function setUnsaved(id: string, unsaved: boolean): void {
  const had = dirty.size > 0;
  if (unsaved) {
    dirty.add(id);
  } else {
    dirty.delete(id);
  }

  /* Only when the *answer* changes — this runs on every keystroke. */
  if (had !== dirty.size > 0) {
    for (const watcher of watchers) {
      watcher();
    }
  }
}

export function hasUnsaved(): boolean {
  return dirty.size > 0;
}
