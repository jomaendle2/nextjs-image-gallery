import { useEffect, useState } from "react";

interface UseCarouselKeyboardProps {
  onNext: () => void;
  onPrevious: () => void;
}

/** Elements that act on Space themselves and must keep it. */
const isInteractive = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target instanceof HTMLButtonElement ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable ||
    target.getAttribute("role") === "button" ||
    target.getAttribute("role") === "checkbox");

export function useCarouselKeyboard({
  onNext,
  onPrevious,
}: UseCarouselKeyboardProps) {
  const [isDisabledState, setIsDisabledState] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDisabledState) {
        return; // Ignore key events if disabled
      }

      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          onNext();
          break;
        case " ": // Spacebar
          /*
           * Space activates whatever control has focus, and the browser only
           * emits that click if nobody calls `preventDefault` on the keydown.
           * Swallowing it unconditionally here meant tabbing to the image
           * button, the close button or a thumbnail and pressing Space
           * advanced the carousel instead of doing what the button said.
           * Space only means "next" when focus is on the page itself.
           */
          if (isInteractive(event.target)) {
            break;
          }
          event.preventDefault();
          onNext();
          break;
        case "ArrowLeft":
          event.preventDefault();
          onPrevious();
          break;
        default:
          break;
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [onNext, onPrevious, isDisabledState]);

  return {
    setIsDisabled: setIsDisabledState,
  };
}
