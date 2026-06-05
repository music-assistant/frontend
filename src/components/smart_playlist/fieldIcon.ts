import { Ban, CalendarRange, Disc3, Heart, Mic2, Tags } from "lucide-vue-next";
import { match } from "ts-pattern";
import type { Component } from "vue";
import type { RuleField } from "@/composables/useSmartPlaylistRulesForm";

export function fieldIcon(field: RuleField): Component {
  return match(field)
    .with("genre", () => Tags)
    .with("artist", () => Mic2)
    .with("album", () => Disc3)
    .with("album_type", () => Disc3)
    .with("favorite", () => Heart)
    .with("year", () => CalendarRange)
    .otherwise(() => Ban);
}
