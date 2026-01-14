import {api} from '../api/client';
import type {MediaItem, MediaItemImage} from '../shared/types';
import {ImageType} from '../shared/types';

// Very small, React Native–friendly subset of the web helpers

export const getMediaImageUrl = (imageUrl?: string): string => {
  if (!imageUrl) {return '';}
  if (imageUrl.startsWith('data:image')) {return imageUrl;}

  // If this already looks like an imageproxy URL, just return it
  if (imageUrl.includes('/imageproxy') && imageUrl.includes('provider=')) {
    return imageUrl;
  }

  // In React Native we usually don't have protocol mismatch issues,
  // so we can return the URL as-is.
  return imageUrl;
};

const imageProviderIsAvailable = (provider: string): boolean => {
  // On mobile we assume providers used in metadata are reachable.
  if (provider === 'http' || provider === 'builtin') {return true;}
  return true;
};

export const getMediaItemImage = (
  mediaItem?: MediaItem | any,
  type: ImageType = ImageType.THUMB,
): MediaItemImage | undefined => {
  if (!mediaItem) {return undefined;}

  // Image on the item itself
  if (
    'image' in mediaItem &&
    mediaItem.image &&
    mediaItem.image.type === type &&
    imageProviderIsAvailable(mediaItem.image.provider)
  ) {
    return mediaItem.image as MediaItemImage;
  }

  // Prefer album image for tracks
  if ('album' in mediaItem && mediaItem.album) {
    const albumImage = getMediaItemImage(mediaItem.album, type);
    if (albumImage) {return albumImage;}
  }

  // Images in metadata.images
  const images = (mediaItem.metadata && (mediaItem.metadata.images as MediaItemImage[])) || [];
  for (const img of images) {
    if (img.type === type && imageProviderIsAvailable(img.provider)) {
      return img;
    }
  }

  // Try artist images
  if ('artists' in mediaItem && mediaItem.artists) {
    for (const artist of mediaItem.artists) {
      const artistImage = getMediaItemImage(artist, type);
      if (artistImage) {return artistImage;}
    }
  }

  // Allow landscape fallback
  if (type === ImageType.THUMB) {
    return getMediaItemImage(mediaItem, ImageType.LANDSCAPE);
  }

  return undefined;
};

export const getMediaItemImageUrl = (
  img: MediaItemImage,
  size?: number,
  checksum?: string,
): string => {
  if (!img || !img.path) {return '';}
  if (img.path.startsWith('data:image')) {return img.path;}

  // If we need resizing or the image isn't remotely accessible, go through imageproxy
  if (!img.remotely_accessible || size) {
    const encUrl = encodeURIComponent(encodeURIComponent(img.path));
    const base = `${api.baseUrl}/imageproxy?path=${encUrl}&provider=${img.provider}&checksum=${checksum ?? ''}`;
    return size ? `${base}&size=${size}` : base;
  }

  return getMediaImageUrl(img.path);
};

export const getImageThumbForItem = (
  mediaItem?: MediaItem | any,
  type: ImageType = ImageType.THUMB,
  size?: number,
): string | undefined => {
  if (!mediaItem) {return undefined;}
  const img = getMediaItemImage(mediaItem, type);
  if (!img || !img.path) {return undefined;}
  const checksum =
    mediaItem.metadata && 'cache_checksum' in mediaItem.metadata
      ? (mediaItem.metadata.cache_checksum as string)
      : '';
  return getMediaItemImageUrl(img, size, checksum);
};

