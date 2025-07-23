import { colorCache } from "./colorCache";

/**
 * Extracts the dominant color from an image using canvas with performance optimizations
 */
export function extractDominantColor(
  imageElement: HTMLImageElement,
  imageId?: string,
): Promise<string> {
  return new Promise((resolve) => {
    // Check cache first
    if (imageId) {
      const cachedColor = colorCache.get(imageId);
      if (cachedColor) {
        resolve(cachedColor);
        return;
      }
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx) {
      resolve("hsl(220, 20%, 15%)"); // fallback
      return;
    }

    // Use smaller canvas for better performance
    canvas.width = 50;
    canvas.height = 50;

    ctx.drawImage(imageElement, 0, 0, 50, 50);

    const imageData = ctx.getImageData(0, 0, 50, 50);
    const data = imageData.data;

    // Color frequency map with reduced precision for better performance
    const colorMap = new Map<string, number>();

    // Sample every 8th pixel for better performance
    for (let i = 0; i < data.length; i += 32) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip transparent pixels
      if (a < 128) continue;

      // Convert to HSL and round more aggressively for grouping
      const hsl = rgbToHsl(r, g, b);
      const key = `${Math.round(hsl.h / 15) * 15},${Math.round(hsl.s / 15) * 15},${Math.round(hsl.l / 15) * 15}`;

      colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }

    // Find the most frequent color
    let maxCount = 0;
    let dominantColor = "hsl(220, 20%, 15%)";

    for (const [color, count] of colorMap) {
      if (count > maxCount) {
        maxCount = count;
        const [h, s, l] = color.split(",").map(Number);
        // Darken the color for background use
        dominantColor = `hsl(${h}, ${Math.min(s, 35)}%, ${Math.min(l, 18)}%)`;
      }
    }

    // Cache the result
    if (imageId) {
      colorCache.set(imageId, dominantColor);
    }

    resolve(dominantColor);
  });
}

// Optimized RGB to HSL conversion
function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
}

// Debounced color extraction for rapid navigation
let colorExtractionTimeout: NodeJS.Timeout | null = null;

export function extractDominantColorDebounced(
  imageElement: HTMLImageElement,
  imageId?: string,
  delay: number = 150,
): Promise<string> {
  return new Promise((resolve) => {
    if (colorExtractionTimeout) {
      clearTimeout(colorExtractionTimeout);
    }

    colorExtractionTimeout = setTimeout(() => {
      extractDominantColor(imageElement, imageId).then(resolve);
    }, delay);
  });
}
