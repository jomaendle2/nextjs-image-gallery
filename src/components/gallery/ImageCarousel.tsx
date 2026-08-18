"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryAuthor, GalleryImage } from "@/data/galleryData";
import { useOverlaidChrome } from "@/hooks/useOverlaidChrome";
import { useRecordView } from "@/hooks/useViewCount";
import { SITE_DESCRIPTION } from "@/lib/metadata";
import { photoGround } from "@/lib/photo-ground";
import { photoAltText } from "@/lib/photos/alt-text";
import { ContributorHeader } from "./ContributorHeader";
import { AmbientBackdrop } from "./carousel/AmbientBackdrop";
import { CaptionBar } from "./carousel/CaptionBar";
import { CarouselImage } from "./carousel/CarouselImage";
import { CarouselNavigation } from "./carousel/CarouselNavigation";
import { GalleryTopBar } from "./carousel/GalleryTopBar";
import { ImageModal } from "./carousel/ImageModal";
import { useCarouselKeyboard } from "./carousel/useCarouselKeyboard";
import { useCarouselScroll } from "./carousel/useCarouselScroll";
import { MembershipOffer } from "./MembershipOffer";

/** How many images to keep mounted on each side of the current one. */
const BUFFER_SIZE = 2;

interface ImageCarouselProps {
  /**
   * Supplied by the server page. This used to be a module-level import of a
   * hardcoded constant, which was the single thing tying the viewer to
   * build-time assets.
   */
  images: readonly GalleryImage[];
  /**
   * Set on a contributor page. Without it that page renders identically to
   * the main gallery, which makes the one URL a photographer actually shares
   * say nothing about whose work it is.
   */
  contributor?: GalleryAuthor;
  /**
   * Whether membership is on sale, for the top bar and for everything under
   * the provider below.
   *
   * Threaded from the server page rather than read here: this file is
   * `"use client"`, and `GalleryTopBar` explains at its own top why that makes
   * an environment read there silently wrong.
   *
   * **Required, with no default.** It was `membershipOffered?: boolean` with
   * `= false`, and that default is exactly how the slideshow page came to
   * render this without it: forgetting the prop produced the correct-looking
   * behaviour on two pages and the wrong one on the third, with nothing to
   * notice. A source-text test now catches it, but a compiler error is
   * better than a test, and the fail-closed default belongs where it cannot
   * be forgotten instead — on the context, which is what a subtree with no
   * provider reads.
   */
  membershipOffered: boolean;
  initialIndex?: number;
}

export function ImageCarousel({
  images,
  contributor,
  initialIndex = 0,
  membershipOffered,
}: ImageCarouselProps) {
  /*
   * The carousel is `fixed inset-0`, sized by the layout viewport — so an
   * in-app browser floating its bottom bar over the page put the filmstrip
   * and caption underneath chrome the layout could not see. The hook
   * measures the shortfall and the `safe-b-*` paddings pick it up.
   */
  useOverlaidChrome();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { carouselRef, goToIndex, scrollToIndex } = useCarouselScroll({
    itemCount: images.length,
    currentIndex,
    onIndexChange: setCurrentIndex,
    // Animate only as far as we actually keep images mounted. Past that the
    // journey is placeholders, so we cut instead.
    smoothScrollDistance: BUFFER_SIZE,
  });

  const goToNext = useCallback(() => {
    goToIndex(currentIndex + 1);
  }, [currentIndex, goToIndex]);

  const goToPrevious = useCallback(() => {
    goToIndex(currentIndex - 1);
  }, [currentIndex, goToIndex]);

  const { setIsDisabled } = useCarouselKeyboard({
    onNext: goToNext,
    onPrevious: goToPrevious,
  });

  // Jump to the requested starting image on first paint.
  useEffect(() => {
    if (initialIndex > 0) {
      // Initial placement is setup, not a transition.
      scrollToIndex(initialIndex, "instant");
    }
  }, [initialIndex, scrollToIndex]);

  /*
   * Grid tiles link to `#<photoId>`. A hash never reaches the server, so this
   * page can open on any photograph while staying statically rendered.
   *
   * The ref, rather than an empty dependency list, is what keeps this to the
   * first paint: once the visitor starts navigating, the carousel owns the
   * index and re-running this would drag them back to where they came in.
   */
  const hasHonouredHash = useRef(false);
  useEffect(() => {
    if (hasHonouredHash.current) {
      return;
    }
    hasHonouredHash.current = true;

    const id = globalThis.location?.hash.slice(1);
    if (!id) {
      return;
    }
    const index = images.findIndex((image) => image.id === id);
    if (index > 0) {
      setCurrentIndex(index);
      scrollToIndex(index, "instant");
    }
  }, [images, scrollToIndex]);

  const handleImageClick = useCallback(() => {
    setIsModalOpen(true);
    setIsDisabled(true);
  }, [setIsDisabled]);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setIsDisabled(false);
  }, [setIsDisabled]);

  // Derived during render: the background is a pure function of the index,
  // so computing it in an effect only bought an extra commit per navigation.
  /*
   * `images` used to be typed as a non-empty tuple, so `?? images[0]` was
   * enough to satisfy `noUncheckedIndexedAccess`. A query result carries no
   * such guarantee, so the empty case is handled honestly rather than cast
   * away. The server page renders <EmptyGallery /> instead of reaching here.
   */
  const currentImage = images[currentIndex] ?? images[0];

  /*
   * Counting a view is a fact about the photograph being looked at, so it
   * belongs here rather than inside whatever happens to be displaying the
   * number. It used to live inside `ViewCount`; when the count moved into the
   * details panel the write would have gone with it, and the counter would
   * have started measuring panel opens.
   *
   * Called before the empty-gallery bail below, because a hook cannot sit
   * after a conditional return. An empty string is a no-op inside the hook.
   */
  useRecordView(currentImage?.id ?? "");

  if (!currentImage) {
    return null;
  }

  const start = Math.max(0, currentIndex - BUFFER_SIZE);
  const end = Math.min(images.length - 1, currentIndex + BUFFER_SIZE);

  return (
    /*
      The one producer of the flag for everything below.

      `GalleryTopBar` takes it as a prop a few lines down and always did.
      What could not reach it was `MemberDetails`, four hops away and inside a
      module-level helper — so a photograph with a member-only note advertised
      a paid tier that leads to a page saying "Not open yet".

      Wrapping the whole fragment rather than only `<main>`: the modal is a
      sibling of `<main>`, not a child, and there is no reason for the one
      subtree that renders over the photograph to be the one that cannot ask.
    */
    <MembershipOffer offered={membershipOffered}>
      {/*
        No backdrop-blur on this layer. It used to blur the whole viewport
        behind an opaque fill: full-frame compositing work every frame for
        pixels nobody could ever see.
      */}
      {/*
        A `main` landmark, like every other page here has. The viewer is a
        fixed full-screen layer rather than a document, which is presumably
        why it ended up as a bare `div` — but it is still the main content of
        the page, and without the landmark there is nothing for a screen
        reader to jump to and nothing a skip link could ever target.
      */}
      <main
        className="fixed inset-0 z-50 flex flex-col transition-colors duration-700 motion-reduce:transition-none"
        style={{
          backgroundColor: photoGround(currentImage.bgColor),
        }}
      >
        <AmbientBackdrop bgColor={currentImage.bgColor} />

        {contributor === undefined ? (
          <GalleryTopBar membershipOffered={membershipOffered} />
        ) : null}

        {contributor === undefined ? (
          <div className="relative z-10">
            <h1 className="px-4 pt-3 text-center font-semibold text-white text-2xl sm:px-8 sm:pt-4 sm:text-3xl md:text-[2.125rem] tracking-[-0.045em] [text-shadow:0_1px_16px_oklch(0%_0_0_/_0.35)]">
              the beauty of earth.
            </h1>
            {/*
              One sentence saying what this is.

              The front page was a wordmark and a photograph: beautiful, and
              silent about what it is or who made it. `scrollHeight` equalled
              `innerHeight`, so there was nothing below the fold because there
              was no below the fold — a stranger sent this link had no way to
              learn anything.

              `SITE_DESCRIPTION` rather than a new sentence, deliberately. It
              is already the site's own words, already the meta description and
              the manifest's, and now lives in one place — so the page cannot
              drift from what a search result and a shared link already say.

              Hidden on short viewports, and that is not a detail: this is
              unshrinkable chrome above a photograph stage that only just got a
              height floor, and on a phone held sideways every line here is
              taken straight out of the picture.
            */}
            <p className="hidden px-4 pt-1.5 text-center text-[0.8125rem] text-white/60 [text-shadow:0_1px_12px_oklch(0%_0_0_/_0.45)] sm:px-8 [@media(min-height:700px)]:block">
              {SITE_DESCRIPTION}
            </p>
          </div>
        ) : (
          <div className="relative z-10">
            <ContributorHeader
              contributor={contributor}
              photoCount={images.length}
              view="slideshow"
            />
          </div>
        )}

        {/*
          `min-h-[45%]` is the floor, and it is the whole landscape fix.

          This was `flex-1 overflow-hidden` and nothing else. `flex-1` means
          `flex: 1 1 0%` — the stage asks for no height of its own and lives
          entirely on what the column has left over. The title, the credit row
          and the dock below it are all unshrinkable, so on anything short they
          take the height first and the stage gets the remainder, which on a
          phone in landscape is a rounding error: measured 27px at 844×390,
          17px at 667×375 and 2px at 740×360. `CarouselImage`'s own vertical
          padding is larger than that on its own, so `max-h-full` resolved to
          zero and the photograph rendered at 0×0. There was no photograph on
          the photography site, on every phone held sideways.

          A floor rather than a fixed height: on a tall phone and on a desktop
          the stage already takes 60-75% of the layer and `flex-1` keeps giving
          it every spare pixel, so nothing about those viewports changes. The
          floor only binds where the chrome would otherwise have eaten it all.

          A percentage, not `vh` or `dvh`: this column is a `fixed inset-0`
          layer, so its own height already is the viewport the reader can see,
          whichever way that viewport is being measured this frame. 45% of the
          parent is therefore exactly 45% of the visible layer, and needs no
          opinion about iOS's large-versus-small viewport — the distinction
          `GlobeOverlay` has to reason about because it sits in normal flow.
        */}
        <div className="relative z-10 min-h-[45%] flex-1 overflow-hidden">
          {/* Main carousel container with scroll snap */}
          <section
            aria-label="Image gallery"
            className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            ref={carouselRef}
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {images.map((image, index) => (
              <div
                /*
                 * `px-2` on a phone, `px-6` from `sm` up.
                 *
                 * On a portrait phone the photograph is bounded by the slot's
                 * width, not the stage's height — so every pixel of horizontal
                 * padding comes straight off the picture in both dimensions.
                 * At 390 the old 48px cost the image 12% of its width and the
                 * same of its height, on the device most of this traffic
                 * arrives on and on a site whose promise to photographers is
                 * about how their work looks.
                 *
                 * Not zero: the frame's rounded corners and hairline ring are
                 * what make it read as a photograph rather than a background,
                 * and they need somewhere to sit. Above `sm` the image is
                 * height-bounded and the padding costs nothing, so it keeps
                 * its original margin.
                 */
                className="flex-shrink-0 w-full h-full flex items-center justify-center snap-center px-2 sm:px-6"
                key={image.id}
              >
                {index >= start && index <= end ? (
                  <CarouselImage
                    alt={photoAltText(image)}
                    /*
                      Exactly one image button is in the tab order: the one
                      being looked at.

                      Every buffered slot rendered a focusable button, and the
                      buffer follows the index, so Tab moved focus to the next
                      photograph's off-screen button. The browser scrolled it
                      into view to show the focused control, the scroll handler
                      read the new position and committed a new index — so
                      pressing Tab changed the photograph, the caption and the
                      backdrop (WCAG 3.2.1, On Focus). Repeat and the visitor
                      walked all N photographs before reaching Previous, Next,
                      the dock, the photographer's name, Share or Details, and
                      arrived at that chrome standing on the last picture
                      rather than the one they started on (WCAG 2.4.3).

                      `tabIndex={-1}` rather than `inert` on the slot: inert
                      would also remove the neighbours from the accessibility
                      tree, and it takes them out of hit testing, which is a
                      larger claim to make about the surface the reader swipes.
                      Keyboard navigation is not lost either way — the arrow
                      keys and the dock both page the carousel.
                    */
                    focusable={index === currentIndex}
                    onClick={handleImageClick}
                    priority={index === currentIndex}
                    src={image.src}
                  />
                ) : (
                  // Placeholder keeps the scroll extents stable.
                  <div className="w-full h-full" />
                )}
              </div>
            ))}
          </section>

          {/* Navigation arrows */}
          <CarouselNavigation
            canGoNext={currentIndex < images.length - 1}
            canGoPrevious={currentIndex > 0}
            onNext={goToNext}
            onPrevious={goToPrevious}
          />
        </div>

        {/*
        The chrome yields, and when there is genuinely not enough room for it
        it scrolls rather than disappearing.

        The floor above has to come out of something. On a phone in landscape
        the caption bar is its tall stacked form — caption, credit, dock, one
        under the other, 243px measured at 844×390 — and the column is 390px
        tall in total, so the two cannot both have what they ask for. This
        wrapper is what lets the bar lose the argument: `min-h-0` undoes the
        `min-height: auto` that stops a flex child shrinking below its content,
        and the bar's own `flex-shrink-0` no longer applies because the wrapper
        is the flex item now.

        `overflow-y-auto` rather than `overflow-hidden` is the part that
        matters. Clipping would leave the dock and the photographer's name
        cut off the bottom of a fixed layer that has no scrollbar of its own —
        present in the DOM, reachable by Tab, and invisible. Scrolling keeps
        every control reachable at the cost of a small gesture, and above the
        short viewports it never engages: when the bar fits, nothing here
        changes at all.

        No `justify-end` in that column, tempting as it is to pin the dock to
        the bottom edge. Content pushed past the *start* of a scroll container
        cannot be scrolled back to — there is no negative scroll position — so
        end-justifying an overflowing box puts the caption and the credit above
        the top of the region and leaves them there. Measured: the dock showed
        and the two rows above it were gone. Normal flow overflows at the
        bottom instead, which is the edge a scrollbar can reach.

        `overflow-x-hidden` alongside it because a box with one axis scrollable
        computes the other to `auto`, and the bar carries negative margins for
        its 44px touch targets — enough to hand the reader a stray horizontal
        scrollbar under the photograph.
      */}
        <div className="relative z-10 flex min-h-0 flex-col overflow-y-auto overflow-x-hidden">
          <CaptionBar
            currentIndex={currentIndex}
            image={currentImage}
            images={images}
            /*
            The details panel takes the keyboard the same way the modal
            does. Without this, arrow keys inside an open panel would page
            the photograph behind it, and the panel would then be describing
            a different picture.

            The setter, passed straight through: it is already stable and
            already `(open: boolean) => void`, so wrapping it in a
            `useCallback` was a second name for the same function.
          */
            onDetailsOpenChange={setIsDisabled}
            onImageSelect={goToIndex}
          />
        </div>
      </main>

      {/* Full screen image modal */}
      {isModalOpen ? (
        <ImageModal image={currentImage} onClose={handleModalClose} />
      ) : null}
    </MembershipOffer>
  );
}
