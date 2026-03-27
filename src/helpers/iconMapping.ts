/**
 * Central mapping from MDI (Material Design Icons) class names to lucide-vue-next components.
 *
 * This is used as a bridge during the migration from MDI CSS icons to lucide components.
 * Some icon strings (e.g. player.icon) come from the server and cannot be replaced at the
 * source, so we resolve them dynamically at render time.
 */
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  Ban,
  BookAudio,
  Calendar,
  CalendarOff,
  Cast,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleMinus,
  CirclePlay,
  CirclePlus,
  Cloud,
  CloudCog,
  Disc3,
  ExternalLink,
  FileCode,
  FileDown,
  FileText,
  FileUp,
  Folder,
  Grid2x2,
  Heart,
  HelpCircle,
  History,
  ImagePlus,
  Import,
  Infinity,
  Info,
  LayoutDashboard,
  LayoutGrid,
  Library,
  Link,
  List,
  ListMusic,
  ListPlus,
  Lock,
  Merge,
  Monitor,
  MoreVertical,
  Music,
  Music2,
  Network,
  Palette,
  Pencil,
  Play,
  Podcast,
  Power,
  Puzzle,
  Radio,
  RefreshCw,
  Repeat,
  Search,
  Server,
  Settings,
  Shuffle,
  SkipForward,
  SlidersHorizontal,
  SlidersVertical,
  AudioLines,
  Speaker,
  Square,
  Star,
  Trash2,
  UserCog,
  UserRound,
  Users,
  Volume2,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-vue-next";

import type { Component } from "vue";

/**
 * Map of MDI icon class names (without the leading "mdi-" prefix in some cases,
 * but we store both forms) to their lucide-vue-next component equivalents.
 */
const mdiToLucideMap: Record<string, LucideIcon> = {
  // Player icons (from server)
  "mdi-speaker": Speaker,
  "mdi-speaker-multiple": AudioLines,
  "mdi-speaker-wireless": Wifi,

  // Playback controls
  "mdi-play": Play,
  "mdi-play-circle": CirclePlay,
  "mdi-play-circle-outline": CirclePlay,
  "mdi-skip-next-circle-outline": SkipForward,
  "mdi-stop": Square,
  "mdi-power": Power,

  // Navigation & actions
  "mdi-heart": Heart,
  "mdi-heart-outline": Heart,
  "mdi-information-outline": Info,
  "mdi-chevron-right": ChevronRight,
  "mdi-chevron-down": ChevronDown,
  "mdi-chevron-up": ChevronUp,
  "mdi-dots-vertical": MoreVertical,
  "mdi-close": X,
  "mdi-magnify": Search,
  "mdi-refresh": RefreshCw,
  "mdi-delete": Trash2,
  "mdi-pencil": Pencil,
  "mdi-arrow-up": ArrowUp,
  "mdi-arrow-down": ArrowDown,
  "mdi-arrow-collapse-down": ArrowDownToLine,

  // Media types
  "mdi-music": Music,
  "mdi-music-note": Music2,
  "mdi-music-note-eighth": Music2,
  "mdi-file-music": Music2,
  "mdi-album": Disc3,
  "mdi-account-music": UserRound,
  "mdi-account-music-outline": UserRound,
  "mdi-playlist-music": ListMusic,
  "mdi-radio": Radio,
  "mdi-radio-tower": Radio,
  "mdi-podcast": Podcast,
  "mdi-book-music": BookAudio,
  "mdi-book-play-outline": BookAudio,
  "mdi-folder": Folder,
  "mdi-help-circle-outline": HelpCircle,

  // Library & playlists
  "mdi-bookshelf": Library,
  "mdi-playlist-plus": ListPlus,
  "mdi-plus-circle-outline": CirclePlus,
  "mdi-minus-circle-outline": CircleMinus,

  // Queue & playback options
  "mdi-shuffle": Shuffle,
  "mdi-shuffle-disabled": Shuffle,
  "mdi-repeat": Repeat,
  "mdi-swap-horizontal": Import,
  "mdi-cancel": Ban,
  "mdi-all-inclusive": Infinity,
  "mdi-import": Import,
  "mdi-playlist-play": ListMusic,

  // Settings
  "mdi-cog": Settings,
  "mdi-cog-outline": Settings,
  "mdi-tune": SlidersHorizontal,
  "mdi-tune-variant": SlidersVertical,
  "mdi-equalizer": SlidersVertical,
  "mdi-volume-high": Volume2,
  "mdi-account-cog": UserCog,
  "mdi-account-multiple": Users,
  "mdi-palette": Palette,
  "mdi-cloud-lock": CloudCog,
  "mdi-server": Server,
  "mdi-file-code": FileCode,
  "mdi-puzzle": Puzzle,

  // View modes
  "mdi-view-list": List,
  "mdi-grid": Grid2x2,
  "mdi-view-comfy": LayoutGrid,
  "mdi-view-dashboard": LayoutDashboard,

  // Selection
  "mdi-select-all": Square,
  "mdi-checkbox-multiple-outline": Square,
  "mdi-checkbox-multiple-blank-outline": Square,

  // Provider/network
  "mdi-link": Link,
  "mdi-link-variant": Link,
  "mdi-open-in-new": ExternalLink,
  "mdi-package-variant": Folder,
  "mdi-lan": Network,
  "mdi-cast": Cast,
  "mdi-cast-variant": Cast,
  "mdi-play-network": Monitor,
  "mdi-cloud": Cloud,

  // Misc
  "mdi-star-box": Star,
  "mdi-image-album": ImagePlus,
  "mdi-merge": Merge,
  "mdi-clock-fast": History,
  "mdi-sort": SlidersVertical,
  "mdi-text-box-search": FileText,
  "mdi-lock": Lock,
  "mdi-sync": RefreshCw,
  "mdi-apple": Monitor,
  "mdi-bullhorn": Volume2,

  // Background tasks
  "mdi-file-document-outline": FileText,
  "mdi-timer-edit-outline": Settings,
  "mdi-calendar-remove": CalendarOff,
  "mdi-calendar-check": Calendar,
  "mdi-timer-sand": History,

  // DSP
  "mdi-file-import": FileDown,
  "mdi-file-export": FileUp,
  "mdi-database-search": Search,
};

/**
 * Resolve an MDI icon class name to a lucide-vue-next component.
 *
 * :param iconName: The MDI class name, e.g. "mdi-heart" or "mdi-speaker".
 * :returns: The matching lucide component, or undefined if not found.
 */
export function resolveMdiIcon(iconName: string): Component | undefined {
  return mdiToLucideMap[iconName];
}

/**
 * Resolve an icon that may be either an MDI string or already a Component.
 * Returns a Component in all cases (falls back to HelpCircle for unknown MDI strings).
 *
 * :param icon: Either an MDI string like "mdi-heart" or a Vue Component.
 * :returns: A Vue Component to render.
 */
export function resolveIcon(icon: string | Component): Component {
  if (typeof icon !== "string") return icon;
  return mdiToLucideMap[icon] || HelpCircle;
}
