// systems
import { createWheelStepper } from "../systems/zoom";

export interface ZoomControls {
  destroy(): void;
}

// A pinch adds up to about this much before it counts as one step.
const WHEEL_THRESHOLD = 40;

/**
 * Cmd/Ctrl with +, - or 0, and Cmd/Ctrl with the wheel (which is also how browsers report a
 * trackpad pinch). `onStep` gets 1 or -1; `onReset` goes back to the default.
 */
export function createZoomControls(
  onStep: (direction: 1 | -1) => void,
  onReset: () => void,
): ZoomControls {
  const stepper = createWheelStepper(WHEEL_THRESHOLD);

  const onKey = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    if (e.key === "+" || e.key === "=") onStep(1);
    else if (e.key === "-" || e.key === "_") onStep(-1);
    else if (e.key === "0") onReset();
    else return;
    // Otherwise the browser or Electron zooms the whole page as well.
    e.preventDefault();
  };

  const onWheel = (e: WheelEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    const direction = stepper(e.deltaY);
    if (direction) onStep(direction);
  };

  window.addEventListener("keydown", onKey);
  // Not passive, or preventDefault is ignored and the page zooms anyway.
  window.addEventListener("wheel", onWheel, { passive: false });
  return {
    destroy() {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    },
  };
}
