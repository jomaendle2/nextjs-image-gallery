"use client";

import { ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Notice } from "@/components/ui/Notice";
import { useServerAction } from "@/hooks/useServerAction";
import type { OwnPhotoRow } from "@/lib/photos/types";
import { count } from "@/lib/plural";
import { bulkRemovePhotos, bulkSetPublished } from "./actions";
import { BulkBar } from "./BulkBar";
import {
  countByStatus,
  type PhotoFilter,
  selectionState,
  selectPhotos,
  toggleAll,
} from "./filter";
import { PhotoCard } from "./PhotoCard";
import { PhotoFilters } from "./PhotoFilters";
import { SelectAll } from "./SelectAll";
import { useViewLayout } from "./useViewLayout";
import { ViewToggle } from "./ViewToggle";
import { listClassName } from "./view";

/**
 * Finding one photograph among many.
 *
 * Filtering happens in the browser rather than the database, and that is a
 * decision with a limit attached: the page already loads every one of a
 * contributor's rows, so filtering here costs nothing and works instantly
 * with no round trip. It stops being right somewhere north of a few hundred
 * photographs, at which point the query — and `listOwnPhotos`, which has no
 * LIMIT — is what needs to change, not this component.
 *
 * Measured with `npm run probe:scale` rather than guessed; the numbers are
 * in `docs/next-version.md`. Re-run it rather than re-reasoning.
 *
 * This component owns the state and nothing else: the two bars it composes
 * are in their own files, and the filtering itself is in `filter.ts`, where
 * it can be tested without rendering anything.
 */

/*
 * How many rows to render before asking.
 *
 * A cap and a button, not numbered pages. Filtering searches the whole set
 * rather than the visible window, so narrowing never misses a match that
 * happened to fall past the cap — which is how paginated search usually goes
 * wrong.
 */
const INITIAL_ROWS = 30;

/** Below this there is nothing to sift through, so the controls are noise. */
const CONTROLS_APPEAR_AT = 4;

/**
 * What a bulk publish did, when it did not do all of it.
 *
 * The count of refusals comes from the server, which checks the same two
 * fields `savePhoto` checks — so this sentence is the only place a
 * photographer learns that "select all → Publish" published nine of ten. The
 * bar cannot say it: publishing empties the selection, which unmounts the bar,
 * so the report has to outlive it and sits where the bar was.
 *
 * `changed === 0` is worth its own sentence rather than "0 published": nothing
 * happened, and a person who pressed a button needs to be told that plainly
 * before they press it again.
 */
function BulkReport({
  changed,
  refused,
}: {
  changed: number;
  refused: number;
}) {
  return (
    <Notice className="mb-4" tone="warning">
      {changed === 0
        ? `Nothing was published. All ${count(refused, "photograph")} still need a title and a description.`
        : `${count(changed, "photograph")} published. ${count(refused, "photograph")} still need a title and a description — open a row and fill both in.`}
    </Notice>
  );
}

export function PhotoList({
  photos,
  mapStyleUrl,
  aiOffered,
  uploader,
}: {
  photos: OwnPhotoRow[];
  /**
   * Read on the server from `MAPTILER_KEY` and drilled down rather than read
   * in the browser, so the key never enters a public bundle. Null is a
   * working state, not a broken one — see `lib/maptiler.ts`.
   */
  mapStyleUrl: string | null;
  /**
   * Whether a model can be asked for a title. Read on the server from the
   * gateway credentials, for the same reason and with the same consequence:
   * false hides a button rather than breaking a page.
   */
  aiOffered: boolean;
  /**
   * The upload box, handed in rather than rendered above.
   *
   * It used to be the page's own child, which was right while the page was
   * one column and wrong the moment it stopped being: the rail this list now
   * sits beside is made of the two things you do *to* the list — add to it,
   * and narrow it — and the component that owns the narrowing is this one.
   * A slot keeps the uploader's own state out of here, which matters, because
   * a batch in flight must not be re-mounted by a keystroke in the search box.
   */
  uploader: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PhotoFilter>("all");

  /*
   * The draft a finished upload asks to have opened, from `?open=`.
   *
   * `UploadForm` writes the first new draft's id there so the photographer
   * lands *in* the editor rather than beside it — the batch used to end on
   * a refreshed list and a hunt for the row you just made. A stale or
   * made-up id matches no row and opens nothing; `PhotoCard` reads the flag
   * once, on mount, so closing the row by hand is not fought by the URL.
   */
  const autoOpenId = useSearchParams().get("open");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  /* List or grid: the count decides the first one, the photographer the rest. */
  const { layout, onLayoutChange } = useViewLayout(photos.length);

  /*
   * Whether the reader is picking photographs, rather than reading them.
   *
   * The per-row checkbox used to be there always, and it explained itself
   * exactly once — in the "Select N photographs" control at the top of the
   * list. On a phone, by the time you have scrolled to a row and opened it,
   * that line is several screens away, so what is actually in front of you is
   * an unlabelled box beside a photograph, doing nothing visible until you
   * tick it. The first question anybody asks about this page is what it is
   * for.
   *
   * So selecting is a mode you enter. Nothing is ticked until you ask to
   * tick, the boxes appear with the bar that acts on them, and the rest of
   * the time a row is a photograph and a form. It also gives every row back
   * about forty pixels of width on a phone, which the title needs more than
   * the checkbox did.
   */
  const [selecting, setSelecting] = useState(false);
  /** What the last bulk publish refused, or null when it refused nothing. */
  const [report, setReport] = useState<{
    changed: number;
    refused: number;
  } | null>(null);
  const { pending, error, run } = useServerAction();

  const revealAll = useCallback(() => setShowAll(true), []);

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  /* Leaving the mode drops the selection with it — a tick nobody can see is
   * a tick nobody meant. */
  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  const startSelecting = useCallback(() => setSelecting(true), []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  /*
   * Stable handlers throughout. Inline closures here would be recreated on
   * every keystroke in the search box, re-rendering the whole list behind
   * it — and `PhotoCard` renders a next/image thumbnail apiece, so this is
   * the difference between typing smoothly at fifty photographs and
   * stuttering.
   */
  /*
   * All three bulk buttons do the same three things — hand the selection to
   * a server action, then empty it — so they say it once. Written out three
   * times, the shared part was the part nobody re-read, which is where a
   * missing `clearSelection` would have hidden: the rows stay ticked, the
   * bar stays up, and pressing again re-runs the action on photographs it
   * has already changed.
   */
  const onSelection = useCallback(
    (action: (ids: string[]) => Promise<unknown>) => {
      run(async () => {
        /*
         * The previous run's report goes before this one starts. Left up, it
         * would describe a batch that is no longer on screen.
         */
        setReport(null);
        await action([...selected]);
        clearSelection();
      });
    },
    [run, selected, clearSelection],
  );

  const publishSelected = useCallback(() => {
    onSelection(async (ids) => {
      const outcome = await bulkSetPublished(ids, true);
      /*
       * Only when something was refused. When everything went live the rows
       * say so themselves — every one of them now reads "Published" — and a
       * notice repeating that is a message about nothing.
       */
      setReport(outcome.refused === 0 ? null : outcome);
    });
  }, [onSelection]);

  const unpublishSelected = useCallback(() => {
    onSelection((ids) => bulkSetPublished(ids, false));
  }, [onSelection]);

  const deleteSelected = useCallback(() => {
    onSelection(bulkRemovePhotos);
  }, [onSelection]);

  const onQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    [],
  );
  const clearQuery = useCallback(() => setQuery(""), []);

  /*
   * One handler on the group rather than a closure per radio. The value is
   * read off the event, which is what a native radio group gives us for
   * free.
   */
  const onFilterChange = useCallback(
    (event: ChangeEvent<HTMLFieldSetElement>) => {
      const target = event.target as unknown as HTMLInputElement;
      setFilter(target.value as PhotoFilter);
    },
    [],
  );

  const counts = useMemo(() => countByStatus(photos), [photos]);
  const visible = useMemo(
    () => selectPhotos(photos, filter, query),
    [photos, filter, query],
  );
  const chosen = useMemo(
    () => photos.filter((photo) => selected.has(photo.id)),
    [photos, selected],
  );
  const allState = useMemo(
    () => selectionState(selected, visible),
    [selected, visible],
  );

  const toggleAllVisible = useCallback(() => {
    setSelected((current) => toggleAll(current, visible));
  }, [visible]);

  /**
   * Rows that have been opened at least once, and must not be unmounted.
   *
   * This list renders `visible`, so a keystroke in the search box used to
   * take an open row out of the tree — and with it the uncontrolled inputs
   * that *are* where a half-written caption lives. `PhotoCard` was careful
   * about this in the small (collapsing a row hides it rather than unmounting
   * it, and says so at length) and the list threw the same work away in the
   * large.
   *
   * Only grows, and only ever holds rows somebody actually opened, so the
   * `INITIAL_ROWS` window still does its job for the untouched hundred.
   */
  const [everOpened, setEverOpened] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  /* Stable, or `PhotoCard`'s `memo` stops holding. */
  const noteOpened = useCallback((id: string) => {
    setEverOpened((current) =>
      current.has(id) ? current : new Set(current).add(id),
    );
  }, []);

  /**
   * What actually goes in the list: the matching window, plus any opened row
   * the filter would otherwise have thrown away.
   *
   * The extras are rendered `hidden` rather than in place — the photographer
   * asked to see a narrower list and should get one. They stay in the DOM so
   * that clearing the search brings their text back exactly as it was.
   */
  const shown = useMemo(() => {
    const window = showAll ? visible : visible.slice(0, INITIAL_ROWS);
    if (everOpened.size === 0) {
      /* The ordinary case: nothing has been opened, so nothing to carry. */
      return window.map((photo) => ({ photo, hidden: false }));
    }

    const inWindow = new Set(window.map((photo) => photo.id));
    return [
      ...window.map((photo) => ({ photo, hidden: false })),
      ...photos
        .filter((photo) => everOpened.has(photo.id) && !inWindow.has(photo.id))
        .map((photo) => ({ photo, hidden: true })),
    ];
  }, [showAll, visible, photos, everOpened]);

  /*
   * The two things you do to a list, kept together and kept beside it.
   *
   * `@container` rather than a breakpoint, and that is the whole reason the
   * rail works at both widths: `PhotoFilters` lays itself out from the space
   * it has been given, not from the size of the window. In one column it is a
   * wide search box with the three status filters alongside; in a 21rem rail
   * on a large screen it stacks. Written with `sm:` it would have read the
   * viewport — which on a 2560px monitor says "plenty of room" about a column
   * narrower than a phone.
   */
  const rail = (
    <aside className="@container space-y-5 xl:sticky xl:top-8 xl:max-h-[calc(100dvh-4rem)] xl:overflow-y-auto xl:pb-2">
      {uploader}
      {photos.length > CONTROLS_APPEAR_AT ? (
        <div className="space-y-3">
          <PhotoFilters
            counts={counts}
            filter={filter}
            onClearQuery={clearQuery}
            onFilterChange={onFilterChange}
            onQueryChange={onQueryChange}
            query={query}
          />
          {/*
            Beside the filters rather than above the list, because it is the
            same kind of thing: neither changes a photograph, both change
            which of them you can see and how.
          */}
          <ViewToggle layout={layout} onChange={onLayoutChange} />
        </div>
      ) : null}
    </aside>
  );

  /*
   * Two columns from `xl` up, one below it, and nothing at all changes below
   * it — the phone and tablet layout is the same markup in the same order it
   * has always been.
   *
   * `xl` rather than `lg` because the rail has a real minimum: the upload box
   * carries five sentences about what happens to a file, and squeezed into
   * the ~15rem a 1024px screen would leave after the list has its share, that
   * paragraph becomes a column of two-word lines. 1280px is where both halves
   * fit at their own size rather than at each other's expense.
   *
   * The list is the column that scrolls. Sticky rail, capped to the viewport
   * so a tall upload box in a short window can still be reached, because a
   * sticky element taller than the screen hides its own bottom edge.
   */
  const workspace = (body: ReactNode) => (
    <div className="mt-8 xl:grid xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:items-start xl:gap-8">
      {rail}
      {/*
        `@container` so the grid counts its columns from this column's width
        rather than the window's. The same markup is a two-across grid on a
        phone and a four-across grid in the wide right-hand column, and no
        viewport breakpoint can describe both.
      */}
      <div className="@container mt-8 xl:mt-0">{body}</div>
    </div>
  );

  if (photos.length === 0) {
    return workspace(
      <p className="text-white/55">
        Nothing here yet. Your first upload will appear here.
      </p>,
    );
  }

  return workspace(
    <>
      {visible.length === 0 ? null : (
        <SelectAll
          matching={visible.length}
          onSelecting={selecting ? stopSelecting : startSelecting}
          onToggle={toggleAllVisible}
          selecting={selecting}
          state={allState}
        />
      )}

      {report === null ? null : (
        <BulkReport changed={report.changed} refused={report.refused} />
      )}

      {chosen.length === 0 ? null : (
        <BulkBar
          chosen={chosen}
          error={error}
          onClear={clearSelection}
          onDelete={deleteSelected}
          onPublish={publishSelected}
          onUnpublish={unpublishSelected}
          pending={pending}
        />
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-white/[0.03] px-4 py-8 text-center text-sm text-white/55">
          Nothing matches{query.trim() === "" ? " that filter" : ` “${query}”`}.
        </p>
      ) : null}

      {/*
        One list, always rendered, with the hiding done per row.

        Two lists was the obvious shape and it was wrong: React reconciles by
        position, so a row moving from a "visible" `<ul>` to a "kept" one is a
        different parent — it unmounts and remounts, taking the uncontrolled
        inputs with it and destroying the very text this exists to protect.
        Moving *within* one list keeps the same instance and React just moves
        the DOM node. `hidden` on the `<li>` is what the filter does now.
      */}
      <ul className={listClassName(layout)}>
        {shown.map(({ photo, hidden }) => (
          <PhotoCard
            aiOffered={aiOffered}
            autoOpen={photo.id === autoOpenId}
            hidden={hidden}
            layout={layout}
            mapStyleUrl={mapStyleUrl}
            key={photo.id}
            onOpen={noteOpened}
            onSelect={selecting ? toggleOne : undefined}
            photo={photo}
            selected={selected.has(photo.id)}
          />
        ))}
      </ul>

      {!showAll && visible.length > INITIAL_ROWS ? (
        <button
          className="glass-hairline mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-5 font-medium text-sm text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          onClick={revealAll}
          type="button"
        >
          <ChevronDown aria-hidden="true" className="mr-1.5" size={15} />
          Show the other {visible.length - INITIAL_ROWS}
        </button>
      ) : null}
    </>,
  );
}
