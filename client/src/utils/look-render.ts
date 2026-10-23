// shared
import { LOOK_PARTS, type Look } from "@void/shared";

// utils
import { lookPartUrl } from "./look-art";

const loaded = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  let image = loaded.get(url);
  if (!image) {
    image = new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => {
        // Let a later attempt retry instead of caching the failure.
        loaded.delete(url);
        reject(new Error(`could not load ${url}`));
      };
      el.src = url;
    });
    loaded.set(url, image);
  }
  return image;
}

/** The pictures that make up a look, bottom layer first. Each part is fetched once, ever. */
export async function loadLookImages(look: Look): Promise<HTMLImageElement[]> {
  const urls = LOOK_PARTS.flatMap((part) => {
    const url = look[part] < 0 ? undefined : lookPartUrl(part, look[part]);
    return url ? [url] : [];
  });
  return Promise.all(urls.map(loadImage));
}

/** Draws a region of every layer onto a canvas, so layers stack the way the generator does. */
export function drawLayers(
  ctx: CanvasRenderingContext2D,
  layers: readonly HTMLImageElement[],
  region: { x: number; y: number; width: number; height: number },
) {
  ctx.imageSmoothingEnabled = false;
  for (const layer of layers) {
    ctx.drawImage(
      layer,
      region.x,
      region.y,
      region.width,
      region.height,
      0,
      0,
      region.width,
      region.height,
    );
  }
}
