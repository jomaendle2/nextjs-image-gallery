import { useEffect, useRef, useState } from "react";

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

  /*
   * Mirrors of the render values, so the listener below can be attached once
   * and stay attached — the same shape `useCarouselScroll` uses, and for the
   * same reason.
   *
   * `onNext` and `onPrevious` are rebuilt by the carousel on every index
   * change, because both close over the current index. With those in the
   * dependency array the effect re-ran on every navigation: a `keydown`
   * listener removed from `window` and a fresh one added, once per photograph,
   * for a handler whose behaviour never changes. Holding an arrow key down
   * churned the listener at the key repeat rate.
   */
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;
  const onPreviousRef = useRef(onPrevious);
  onPreviousRef.current = onPrevious;
  const isDisabledRef = useRef(isDisabledState);
  isDisabledRef.current = isDisabledState;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDisabledRef.current) {
        return; // Ignore key events if disabled
      }

      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          onNextRef.current();
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
          onNextRef.current();
          break;
        case "ArrowLeft":
          event.preventDefault();
          onPreviousRef.current();
          break;
        default:
          break;
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return {
    setIsDisabled: setIsDisabledState,
  };
}
