import { LayoutGrid, LayoutList } from "@lucide/vue";

// the small heading above each group of controls in the Filters panel
export const SECTION_LABEL_CLASS =
  "text-xs font-medium tracking-wide text-muted-foreground uppercase";

// the same heading above each part of the sort menu
export const MENU_SECTION_LABEL_CLASS =
  "text-xs text-muted-foreground uppercase";

// the ways a library page can show its items
export const VIEW_MODES = [
  {
    value: "panel",
    label: "view.panel",
    shortLabel: "view.panel_short",
    icon: LayoutGrid,
  },
  {
    value: "list",
    label: "view.list",
    shortLabel: "view.list_short",
    icon: LayoutList,
  },
] as const;

export type ListingViewMode = (typeof VIEW_MODES)[number]["value"];
