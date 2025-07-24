import { useEffect } from "react";

interface UseCarouselKeyboardProps {
  onNext: () => void;
  onPrevious: () => void;
  onClose?: () => void;
}

export function useCarouselKeyboard({
  onNext,
  onPrevious,
  onClose,
}: UseCarouselKeyboardProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowRight":
        case " ": // Spacebar
          event.preventDefault();
          onNext();
          break;
        case "ArrowLeft":
          event.preventDefault();
          onPrevious();
          break;
        case "Escape":
          event.preventDefault();
          onClose?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNext, onPrevious, onClose]);
}
