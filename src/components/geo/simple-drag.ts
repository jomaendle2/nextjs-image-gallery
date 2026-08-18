/**
 * The drag the inline globe has always had, and all it needs.
 *
 * A file of its own for one reason, and it is the same reason `GlobeCanvas`
 * takes `attach` as a prop: whatever the inline globe imports, every visitor
 * to `/globe` downloads. This is twenty lines; `gestures.ts` — with pinch,
 * wheel, tilt, magnification and hit testing behind it — is about eight
 * kilobytes gzipped. Putting the modest version next to the full one would
 * quietly undo the split.
 * One pointer, one axis, no tilt, no zoom, no hit testing — a nudge to a
 * picture rather than an instrument.
 *
 * It deliberately does not set `settled`: the inline globe is meant to keep
 * turning, and freezing it on a click was a real regression once already.
 */
export function simpleDrag(
  canvas: HTMLCanvasElement,
  wake: () => void,
  refs: { holding: { current: number | null }; dragged: { current: number } },
): () => void {
  let from = 0;

  const onDown = (event: PointerEvent) => {
    refs.holding.current = event.pointerId;
    from = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  };
  const onMove = (event: PointerEvent) => {
    if (refs.holding.current !== event.pointerId) {
      return;
    }
    const { width } = canvas.getBoundingClientRect();
    refs.dragged.current += ((event.clientX - from) / (width || 1)) * 180;
    from = event.clientX;
    // A still globe has stopped rendering; a drag has to wake it.
    wake();
  };
  const onUp = (event: PointerEvent) => {
    if (refs.holding.current === event.pointerId) {
      refs.holding.current = null;
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  return () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
  };
}
