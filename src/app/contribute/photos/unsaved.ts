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

/**
 * Where somebody tried to go while a row was dirty, and nothing more.
 *
 * The guard is one component and the links are several, in a tree neither
 * owns — `WorkspaceNav` renders inside `ContributeShell`'s header, and the
 * panel that asks the question belongs at the bottom of the viewport. So the
 * destination travels the same way `dirty` does, for the same reason: the
 * alternative is a context provider wrapped around the whole workspace to
 * carry one nullable string, which would drag three server-rendered pages
 * across the client boundary to do it.
 *
 * A single destination rather than a queue. Two blocked clicks in a row is
 * one person changing their mind, and the second is the one they meant.
 */
let leaving: string | null = null;
const exits = new Set<() => void>();

export function watchPendingExit(onChange: () => void): () => void {
  exits.add(onChange);
  return () => {
    exits.delete(onChange);
  };
}

/** Called by a link that has just cancelled its own navigation. */
export function askBeforeLeaving(href: string): void {
  leaving = href;
  for (const exit of exits) {
    exit();
  }
}

export function pendingExit(): string | null {
  return leaving;
}

export function clearPendingExit(): void {
  if (leaving === null) {
    return;
  }
  leaving = null;
  for (const exit of exits) {
    exit();
  }
}
