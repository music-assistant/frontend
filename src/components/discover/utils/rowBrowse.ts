import type { RecommendationFolder } from "@/plugins/api/interfaces";
import type { RouteLocationRaw } from "vue-router";

// The server lists every recommendation row, with all of its items, under
// this browse scheme: discover://<provider>/<item_id>.
export const DISCOVER_BROWSE_SCHEME = "discover";

type RowRef = Pick<RecommendationFolder, "provider" | "item_id">;

export const rowBrowsePath = (folder: RowRef): string =>
  `${DISCOVER_BROWSE_SCHEME}://${folder.provider}/${folder.item_id}`;

// The Browse page listing all items of a Discover row.
export const rowBrowseRoute = (folder: RowRef): RouteLocationRaw => ({
  name: "browse",
  query: { path: rowBrowsePath(folder) },
});
