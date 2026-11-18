import { artistProvidersForFeature } from "@/components/artist/artistData";
import { rowSourceLabel } from "@/components/details/rowRegistry";
import {
  albumCoverage,
  pickedArtists,
  type AlbumCoverage,
  type PickedArtists,
} from "@/helpers/rotation_library";
import api from "@/plugins/api";
import {
  ProviderFeature,
  type Album,
  type Artist,
  type RotationStep,
} from "@/plugins/api/interfaces";
import { inject, ref, watch, type InjectionKey } from "vue";

const LOOKUP_DELAY_MS = 800;

/** An artist that has albums on a provider which are not in the library. */
export interface LibraryHint extends AlbumCoverage {
  artistId: string;
  artistName: string;
  providerInstance: string;
  providerName: string;
}

interface ArtistAlbums {
  artist: Artist;
  libraryAlbums: Album[];
}

export type AlbumLookupCache = ReturnType<typeof createAlbumLookupCache>;

export const ALBUM_LOOKUP_CACHE_KEY: InjectionKey<AlbumLookupCache> = Symbol(
  "rotationAlbumLookupCache",
);

/**
 * A store for the album lookups behind the library hints. Each artist and each
 * of its provider catalogs is asked for once, one request at a time.
 */
export function createAlbumLookupCache() {
  const artists = new Map<string, Promise<ArtistAlbums | null>>();
  const catalogs = new Map<string, Promise<Album[] | null>>();
  let queue: Promise<unknown> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  function artistAlbums(artistId: string): Promise<ArtistAlbums | null> {
    let entry = artists.get(artistId);
    if (!entry) {
      entry = enqueue(async () => {
        try {
          const artist = await api.getArtist(artistId, "library");
          const libraryAlbums = await api.getArtistAlbums(
            artistId,
            "library",
            undefined,
            undefined,
            0,
          );
          return { artist, libraryAlbums };
        } catch (error) {
          console.debug("Rotation library hint: artist lookup failed", error);
          return null;
        }
      });
      artists.set(artistId, entry);
    }
    return entry;
  }

  function catalogAlbums(
    artist: Artist,
    instanceId: string,
  ): Promise<Album[] | null> {
    const key = `${artist.item_id}|${instanceId}`;
    let entry = catalogs.get(key);
    if (!entry) {
      const mapping = artist.provider_mappings.find(
        (candidate) => candidate.provider_instance === instanceId,
      );
      entry = enqueue(async () => {
        if (!mapping) return null;
        try {
          return await api.getArtistAlbums(
            mapping.item_id,
            mapping.provider_instance,
            undefined,
            undefined,
            0,
          );
        } catch (error) {
          console.debug("Rotation library hint: album lookup failed", error);
          return null;
        }
      });
      catalogs.set(key, entry);
    }
    return entry;
  }

  /**
   * The providers on which an artist has albums the library does not hold.
   * @param artistId The library id of the artist.
   * @param albumTypes Only count these album types; every type when undefined.
   */
  async function hintsFor(
    artistId: string,
    albumTypes?: string[],
  ): Promise<LibraryHint[]> {
    const found = await artistAlbums(artistId);
    if (!found) return [];
    const { artist, libraryAlbums } = found;
    const hints: LibraryHint[] = [];
    // the sources the artist's album listing offers, so the link opens on it
    const instances = artistProvidersForFeature(
      artist,
      ProviderFeature.ARTIST_ALBUMS,
    ).filter((id) => api.providers[id]?.is_streaming_provider);
    for (const instanceId of instances) {
      const albums = await catalogAlbums(artist, instanceId);
      if (!albums) continue;
      const coverage = albumCoverage(albums, libraryAlbums, albumTypes);
      if (coverage.inLibrary >= coverage.total) continue;
      hints.push({
        ...coverage,
        artistId,
        artistName: artist.name,
        providerInstance: instanceId,
        providerName: rowSourceLabel(instanceId),
      });
    }
    return hints;
  }

  return { hintsFor };
}

/**
 * The library hints of a Keep step: artists it picks that have albums on a
 * streaming provider which are not in the library. Looked up after the picks
 * settle, and only again when they change.
 * @param step Getter for the step.
 * @param enabled Getter for whether the step works on albums from the library.
 */
export function useRotationLibraryHints(
  step: () => RotationStep,
  enabled: () => boolean,
) {
  const cache =
    inject(ALBUM_LOOKUP_CACHE_KEY, null) ?? createAlbumLookupCache();
  const hints = ref<LibraryHint[]>([]);

  // a plain string, so a new step object with the same picks looks up nothing
  const lookupKey = () => {
    const picks = enabled() ? pickedArtists(step()) : undefined;
    return picks ? JSON.stringify(picks) : "";
  };

  watch(
    lookupKey,
    (key, _old, onCleanup) => {
      let current = true;
      onCleanup(() => {
        current = false;
      });
      if (!key) {
        hints.value = [];
        return;
      }
      const timer = setTimeout(async () => {
        const { artistIds, albumTypes } = JSON.parse(key) as PickedArtists;
        const found: LibraryHint[] = [];
        for (const artistId of artistIds) {
          found.push(...(await cache.hintsFor(artistId, albumTypes)));
          if (!current) return;
        }
        hints.value = found;
      }, LOOKUP_DELAY_MS);
      onCleanup(() => clearTimeout(timer));
    },
    { immediate: true },
  );

  return { hints };
}
