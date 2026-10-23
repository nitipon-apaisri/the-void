export interface ZoomControls {
  destroy(): void;
}

export interface ZoomHandlers {
  /** Cmd/Ctrl with + or -. */
  onStep(direction: 1 | -1): void;
  /** Cmd/Ctrl with 0. */
  onReset(): void;
  /** A trackpad pinch (browsers report it as Ctrl + wheel) or Cmd/Ctrl + wheel; at the pointer. */
  onPinch(deltaY: number, x: number, y: number): void;
}

export function createZoomControls({ onStep, onReset, onPinch }: ZoomHandlers): ZoomControls {
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
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      onPinch(e.deltaY, e.clientX, e.clientY);
      return;
    }
    // Two-finger scroll over the map zooms too; the panels above it scroll on their own.
    if (e.target instanceof HTMLCanvasElement) {
      e.preventDefault();
      onPinch(e.deltaY, e.clientX, e.clientY);
    }
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
