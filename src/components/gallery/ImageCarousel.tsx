"use client";

import { useCallback, useEffect, useState } from "react";
import { galleryImages } from "@/data/galleryData";
import { CarouselImage } from "./carousel/CarouselImage";
import { CarouselNavigation } from "./carousel/CarouselNavigation";
import { CarouselTopBar } from "./carousel/CarouselTopBar";
import { ImageIndicators } from "./carousel/ImageIndicators";
import { ImageInfo } from "./carousel/ImageInfo";
import { ImageModal } from "./carousel/ImageModal";
import { useCarouselKeyboard } from "./carousel/useCarouselKeyboard";
import { useCarouselScroll } from "./carousel/useCarouselScroll";

/** How many images to keep mounted on each side of the current one. */
const BUFFER_SIZE = 2;

interface ImageCarouselProps {
  initialIndex?: number;
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  onClose?: () => void;
}

export function ImageCarousel({
  initialIndex = 0,
  currentIndex: externalCurrentIndex,
  onIndexChange,
  onClose,
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(
    externalCurrentIndex ?? initialIndex,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const updateCurrentIndex = useCallback(
    (newIndex: number) => {
      setCurrentIndex(newIndex);
      onIndexChange?.(newIndex);
    },
    [onIndexChange],
  );

  const { carouselRef, goToIndex, scrollToIndex } = useCarouselScroll({
    itemCount: galleryImages.length,
    currentIndex,
    onIndexChange: updateCurrentIndex,
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

  // Sync an externally controlled index back into the scroll position.
  useEffect(() => {
    if (
      externalCurrentIndex !== undefined &&
      externalCurrentIndex !== currentIndex
    ) {
      setCurrentIndex(externalCurrentIndex);
      /*
       * Instant, not smooth. A smooth scroll here does not run through
       * `goToIndex`, so the free-scroll tracker stays armed and reports every
       * intermediate frame back through `onIndexChange`, which re-enters this
       * effect and schedules another scroll. Placing a controlled index is
       * setup, the same as `initialIndex`.
       */
      scrollToIndex(externalCurrentIndex, "instant");
    }
  }, [externalCurrentIndex, currentIndex, scrollToIndex]);

  // Jump to the requested starting image on first paint.
  useEffect(() => {
    if (initialIndex > 0) {
      // Initial placement is setup, not a transition.
      scrollToIndex(initialIndex, "instant");
    }
  }, [initialIndex, scrollToIndex]);

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
  const currentImage = galleryImages[currentIndex] ?? galleryImages[0];
  const start = Math.max(0, currentIndex - BUFFER_SIZE);
  const end = Math.min(galleryImages.length - 1, currentIndex + BUFFER_SIZE);

  return (
    <>
      {/*
        No backdrop-blur on this layer. It used to blur the whole viewport
        behind an opaque fill: full-frame compositing work every frame for
        pixels nobody could ever see.
      */}
      <div
        className="fixed inset-0 z-50 flex flex-col transition-colors duration-700 motion-reduce:transition-none"
        style={{ backgroundColor: currentImage.bgColor }}
      >
        {/*
          Ambient depth. Two neutral radial washes over the flat photo
          colour: a soft light from above, a heavier fall-off at the base.
          Neutral rather than tinted, so it works for all fourteen colours
          without a per-image gradient.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(120% 85% at 50% 18%, oklch(100% 0 0 / 0.12), transparent 58%), radial-gradient(100% 95% at 50% 118%, oklch(0% 0 0 / 0.38), transparent 62%)",
          }}
        />
        {/* Keeps white chrome legible over pale images. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-40 z-0 scrim-top"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-64 z-0 scrim-bottom"
        />

        <CarouselTopBar onClose={onClose} />

        <h1 className="relative z-10 text-center font-semibold text-white text-2xl sm:text-3xl md:text-[2.125rem] tracking-[-0.045em] [text-shadow:0_1px_16px_oklch(0%_0_0_/_0.35)]">
          the beauty of earth.
        </h1>

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
            {galleryImages.map((image, index) => (
              <div
                className="flex-shrink-0 w-full h-full flex items-center justify-center snap-center px-6"
                key={image.id}
              >
                {index >= start && index <= end ? (
                  <CarouselImage
                    alt={image.title}
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
            canGoNext={currentIndex < galleryImages.length - 1}
            canGoPrevious={currentIndex > 0}
            onNext={goToNext}
            onPrevious={goToPrevious}
          />
        </div>

        <div className="relative z-10 flex-shrink-0 px-6 pb-10 space-y-4">
          <ImageInfo image={currentImage} />
          <ImageIndicators
            currentIndex={currentIndex}
            images={galleryImages}
            onImageSelect={goToIndex}
          />
        </div>
      </div>

      {/* Full screen image modal */}
      <ImageModal
        image={currentImage}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
    </>
  );
}
