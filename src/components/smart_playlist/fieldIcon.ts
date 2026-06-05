import { Ban, CalendarRange, Disc3, Heart, Mic2, Tags } from "lucide-vue-next";
import type { Component } from "vue";
import type { RuleField } from "@/composables/useSmartPlaylistRulesForm";

export function fieldIcon(field: RuleField): Component {
  switch (field) {
    case "genre":
      return Tags;
    case "artist":
      return Mic2;
    case "album":
      return Disc3;
    case "album_type":
      return Disc3;
    case "favorite":
      return Heart;
    case "year":
      return CalendarRange;
    default:
      return Ban;
  }
}
