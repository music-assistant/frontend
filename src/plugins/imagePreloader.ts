/**
 * Image Preloader - Pre-fetches and caches all album art on app startup
 *
 * This runs in the background when the app connects to ensure images
 * are "already there" when the user navigates to library views.
 */

import { api } from "./api";
import { getImageThumbForItem } from "@/components/MediaItemThumb.vue";
import { ImageType, type MediaItemType } from "./api/interfaces";

// Track preload state
let isPreloading = false;
let preloadedCount = 0;
let totalToPreload = 0;

// Concurrency limit to avoid overwhelming the server
const CONCURRENT_FETCHES = 6;
const THUMB_SIZE = 256;

/**
 * Preload a single image by fetching it (browser/SW will cache it)
 */
async function preloadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * Preload images in batches with concurrency control
 */
async function preloadBatch(urls: string[]): Promise<void> {
  const queue = [...urls];
  const workers: Promise<void>[] = [];

  for (let i = 0; i < CONCURRENT_FETCHES; i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const url = queue.shift();
          if (url) {
            await preloadImage(url);
            preloadedCount++;
          }
        }
      })(),
    );
  }

  await Promise.all(workers);
}

/**
 * Get image URL for a media item
 */
function getItemImageUrl(item: MediaItemType): string | undefined {
  return getImageThumbForItem(item, ImageType.THUMB, THUMB_SIZE);
}

/**
 * Start preloading all library images
 * Call this after API connection is established
 */
export async function startImagePreload(): Promise<void> {
  if (isPreloading) {
    console.log("[ImagePreloader] Already preloading, skipping");
    return;
  }

  isPreloading = true;
  preloadedCount = 0;
  const imageUrls: string[] = [];

  console.log("[ImagePreloader] Starting library image preload...");

  try {
    // Fetch all library items in parallel
    const [albums, artists, playlists, radios] = await Promise.all([
      api
        .getLibraryAlbums(undefined, undefined, 1000, 0, "name")
        .catch(() => []),
      api
        .getLibraryArtists(undefined, undefined, 500, 0, "name")
        .catch(() => []),
      api
        .getLibraryPlaylists(undefined, undefined, 200, 0, "name")
        .catch(() => []),
      api
        .getLibraryRadios(undefined, undefined, 100, 0, "name")
        .catch(() => []),
    ]);

    // Extract image URLs
    for (const item of albums) {
      const url = getItemImageUrl(item);
      if (url) imageUrls.push(url);
    }

    for (const item of artists) {
      const url = getItemImageUrl(item);
      if (url) imageUrls.push(url);
    }

    for (const item of playlists) {
      const url = getItemImageUrl(item);
      if (url) imageUrls.push(url);
    }

    for (const item of radios) {
      const url = getItemImageUrl(item);
      if (url) imageUrls.push(url);
    }

    // Remove duplicates
    const uniqueUrls = [...new Set(imageUrls)];
    totalToPreload = uniqueUrls.length;

    console.log(`[ImagePreloader] Preloading ${totalToPreload} images...`);

    // Start preloading in batches
    await preloadBatch(uniqueUrls);

    console.log(
      `[ImagePreloader] Complete! Preloaded ${preloadedCount}/${totalToPreload} images`,
    );
  } catch (error) {
    console.error("[ImagePreloader] Error during preload:", error);
  } finally {
    isPreloading = false;
  }
}

/**
 * Get current preload progress
 */
export function getPreloadProgress(): {
  current: number;
  total: number;
  isLoading: boolean;
} {
  return {
    current: preloadedCount,
    total: totalToPreload,
    isLoading: isPreloading,
  };
}

/**
 * Preload images for a specific list of items (useful for pagination)
 */
export async function preloadItemImages(items: MediaItemType[]): Promise<void> {
  const urls = items
    .map((item) => getItemImageUrl(item))
    .filter((url): url is string => !!url);

  if (urls.length > 0) {
    await preloadBatch(urls);
  }
}
