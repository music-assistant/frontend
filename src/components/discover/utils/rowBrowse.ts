import type { RecommendationFolder } from "@/plugins/api/interfaces";
import type { RouteLocationRaw } from "vue-router";

import { DISCOVER_BROWSE_SCHEME } from "@/helpers/discover_browse";

type RowRef = Pick<RecommendationFolder, "provider" | "item_id">;

export const rowBrowsePath = (folder: RowRef): string =>
  `${DISCOVER_BROWSE_SCHEME}://${folder.provider}/${folder.item_id}`;

// The Browse page listing all items of a Discover row.
export const rowBrowseRoute = (folder: RowRef): RouteLocationRaw => ({
  name: "browse",
  query: { path: rowBrowsePath(folder) },
});
