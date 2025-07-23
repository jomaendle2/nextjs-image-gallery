interface ColorCacheEntry {
  color: string;
  timestamp: number;
}

class ColorCache {
  private cache = new Map<string, ColorCacheEntry>();
  private readonly MAX_AGE = 5 * 60 * 1000; // 5 minutes

  set(imageId: string, color: string): void {
    this.cache.set(imageId, {
      color,
      timestamp: Date.now(),
    });
  }

  get(imageId: string): string | null {
    const entry = this.cache.get(imageId);
    if (!entry) return null;

    // Check if entry is still valid
    if (Date.now() - entry.timestamp > this.MAX_AGE) {
      this.cache.delete(imageId);
      return null;
    }

    return entry.color;
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.MAX_AGE) {
        this.cache.delete(key);
      }
    }
  }
}

export const colorCache = new ColorCache();

// Clean up expired entries every 5 minutes
setInterval(
  () => {
    colorCache.cleanup();
  },
  5 * 60 * 1000,
);
