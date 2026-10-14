import { favoriteState } from "@/helpers/favorites";
import type {
  Album,
  MediaItem,
  MediaItemType,
  MediaItemTypeOrItemMapping,
  PodcastEpisode,
  Track,
} from "@/plugins/api/interfaces";

export interface ItemListingFilterParams {
  offset: number;
  limit: number;
  sortBy: string;
  search: string;
  favoritesOnly?: boolean;
  hideFullyPlayed?: boolean;
  albumType?: string[];
}

function getSortName(
  item: MediaItemType | MediaItemTypeOrItemMapping | null | undefined,
  preferSortName = false,
): string {
  if (!item) return "";
  if (preferSortName && "sort_name" in item && item.sort_name) {
    return item.sort_name;
  }
  return item.name;
}

function getDateAdded(item: MediaItemType): number {
  const dateAdded = (item as MediaItem).date_added;
  const time = dateAdded ? Date.parse(dateAdded) : 0;
  return Number.isNaN(time) ? 0 : time;
}

export function filterAndSortItems(
  items: MediaItemType[],
  params: ItemListingFilterParams,
): MediaItemType[] {
  let result: MediaItemType[];

  if (params.search) {
    const searchString = params.search.toLowerCase();
    result = items.filter((item) => {
      if (item.name.toLowerCase().includes(searchString)) return true;
      if (
        "album" in item &&
        item.album?.name.toLowerCase().includes(searchString)
      ) {
        return true;
      }
      return Boolean(
        "artists" in item &&
        item.artists?.length &&
        item.artists[0].name.toLowerCase().includes(searchString),
      );
    });
  } else {
    result = [...items];
  }

  if (params.sortBy === "name") {
    result.sort((a, b) =>
      getSortName(a).localeCompare(getSortName(b), undefined, {
        numeric: true,
      }),
    );
  }
  if (params.sortBy === "sort_name") {
    result.sort((a, b) =>
      getSortName(a, true).localeCompare(getSortName(b, true), undefined, {
        numeric: true,
      }),
    );
  }
  if (params.sortBy === "name_desc") {
    result.sort((a, b) =>
      getSortName(b).localeCompare(getSortName(a), undefined, {
        numeric: true,
      }),
    );
  }
  if (params.sortBy === "sort_name_desc") {
    result.sort((a, b) =>
      getSortName(b, true).localeCompare(getSortName(a, true), undefined, {
        numeric: true,
      }),
    );
  }

  if (params.sortBy === "album" || params.sortBy === "album_sort_name") {
    const preferSortName = params.sortBy === "album_sort_name";
    result.sort((a, b) => {
      const albumCompare = getSortName(
        (a as Track).album,
        preferSortName,
      ).localeCompare(
        getSortName((b as Track).album, preferSortName),
        undefined,
        { numeric: true },
      );
      if (albumCompare !== 0) return albumCompare;
      const discCompare =
        ((a as Track).disc_number ?? 0) - ((b as Track).disc_number ?? 0);
      if (discCompare !== 0) return discCompare;
      return (
        ((a as Track).track_number ?? 0) - ((b as Track).track_number ?? 0)
      );
    });
  }
  if (params.sortBy === "artist") {
    result.sort((a, b) =>
      getSortName((a as Track).artists[0]).localeCompare(
        getSortName((b as Track).artists[0]),
      ),
    );
  }
  if (params.sortBy === "track_number") {
    result.sort(
      (a, b) =>
        ((a as Track).track_number || 0) - ((b as Track).track_number || 0),
    );
    result.sort(
      (a, b) =>
        ((a as Track).disc_number || 0) - ((b as Track).disc_number || 0),
    );
  }
  if (params.sortBy === "position") {
    result.sort(
      (a, b) => ((a as Track).position || 0) - ((b as Track).position || 0),
    );
  }
  if (params.sortBy === "position_desc") {
    result.sort(
      (a, b) => ((b as Track).position || 0) - ((a as Track).position || 0),
    );
  }
  if (params.sortBy === "timestamp_added") {
    result.sort((a, b) => getDateAdded(a) - getDateAdded(b));
  }
  if (params.sortBy === "timestamp_added_desc") {
    result.sort((a, b) => getDateAdded(b) - getDateAdded(a));
  }
  if (params.sortBy === "year") {
    result.sort((a, b) => ((a as Album).year || 0) - ((b as Album).year || 0));
  }
  if (params.sortBy === "year_desc") {
    result.sort((a, b) => ((b as Album).year || 0) - ((a as Album).year || 0));
  }
  if (params.sortBy === "duration") {
    result.sort(
      (a, b) => ((a as Track).duration || 0) - ((b as Track).duration || 0),
    );
  }
  if (params.sortBy === "duration_desc") {
    result.sort(
      (a, b) => ((b as Track).duration || 0) - ((a as Track).duration || 0),
    );
  }
  if (params.sortBy === "provider") {
    result.sort((a, b) => a.provider.localeCompare(b.provider));
  }

  if (params.favoritesOnly) {
    result = result.filter((item) => favoriteState(item) === true);
  }
  if (params.hideFullyPlayed) {
    result = result.filter(
      (item) => (item as PodcastEpisode).fully_played !== true,
    );
  }
  if (params.albumType?.length) {
    result = result.filter((item) =>
      params.albumType?.includes((item as Album).album_type),
    );
  }
  return result.slice(params.offset, params.offset + params.limit);
}
