import { useEffect } from "react";

interface UseCarouselKeyboardProps {
  onPrevious: () => void;
  onNext: () => void;
  onViewModeChange: () => void;
  currentIndex: number;
}

export function useCarouselKeyboard({
  onPrevious,
  onNext,
  onViewModeChange,
  currentIndex,
}: UseCarouselKeyboardProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        onPrevious();
      }
      if (e.key === "ArrowRight") {
        onNext();
      }
      if (e.key === "Escape") {
        onViewModeChange();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, onPrevious, onNext, onViewModeChange]);
}
