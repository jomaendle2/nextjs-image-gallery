"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryAuthor, GalleryImage } from "@/data/galleryData";
import { photoGround } from "@/lib/photo-ground";
import { photoAltText } from "@/lib/photos/alt-text";
import { ContributorHeader } from "./ContributorHeader";
import { AmbientBackdrop } from "./carousel/AmbientBackdrop";
import { CaptionBar } from "./carousel/CaptionBar";
import { CarouselImage } from "./carousel/CarouselImage";
import { CarouselNavigation } from "./carousel/CarouselNavigation";
import { CarouselTopBar } from "./carousel/CarouselTopBar";
import { GalleryTopBar } from "./carousel/GalleryTopBar";
import { ImageModal } from "./carousel/ImageModal";
import { useCarouselKeyboard } from "./carousel/useCarouselKeyboard";
import { useCarouselScroll } from "./carousel/useCarouselScroll";

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
  initialIndex?: number;
  onClose?: () => void;
}

export function ImageCarousel({
  images,
  contributor,
  initialIndex = 0,
  onClose,
}: ImageCarouselProps) {
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
    onClose,
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
  if (!currentImage) {
    return null;
  }

  const start = Math.max(0, currentIndex - BUFFER_SIZE);
  const end = Math.min(images.length - 1, currentIndex + BUFFER_SIZE);

  return (
    <>
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

        <CarouselTopBar onClose={onClose} />

        {contributor === undefined ? <GalleryTopBar /> : null}

        {contributor === undefined ? (
          <h1 className="relative z-10 px-4 pt-3 text-center font-semibold text-white text-2xl sm:px-8 sm:pt-4 sm:text-3xl md:text-[2.125rem] tracking-[-0.045em] [text-shadow:0_1px_16px_oklch(0%_0_0_/_0.35)]">
            the beauty of earth.
          </h1>
        ) : (
          <div className="relative z-10">
            <ContributorHeader
              contributor={contributor}
              photoCount={images.length}
              view="slideshow"
            />
          </div>
        )}

        <div className="relative z-10 flex-1 overflow-hidden">
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
                className="flex-shrink-0 w-full h-full flex items-center justify-center snap-center px-6"
                key={image.id}
              >
                {index >= start && index <= end ? (
                  <CarouselImage
                    alt={photoAltText(image)}
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

        <CaptionBar
          currentIndex={currentIndex}
          image={currentImage}
          images={images}
          onImageSelect={goToIndex}
        />
      </main>

      {/* Full screen image modal */}
      {isModalOpen ? (
        <ImageModal image={currentImage} onClose={handleModalClose} />
      ) : null}
    </>
  );
}
