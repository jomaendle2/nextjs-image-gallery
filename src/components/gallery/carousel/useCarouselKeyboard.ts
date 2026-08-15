import { useEffect, useState } from "react";

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
  const [isDisabledState, setIsDisabledState] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDisabledState) {
        return; // Ignore key events if disabled
      }

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

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [onNext, onPrevious, onClose, isDisabledState]);

  return {
    setIsDisabled: setIsDisabledState,
  };
}
