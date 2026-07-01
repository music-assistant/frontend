import ExplicitIcon from "@/components/icons/ExplicitIcon.vue";
import type { RuleField } from "@/composables/useSmartPlaylistRulesForm";
import {
  Ban,
  CalendarRange,
  Disc3,
  Heart,
  History,
  Mic2,
  Tags,
  Timer,
} from "@lucide/vue";
import { match } from "ts-pattern";
import type { Component } from "vue";

export function fieldIcon(field: RuleField): Component {
  return match(field)
    .with("genre", () => Tags)
    .with("artist", () => Mic2)
    .with("album", () => Disc3)
    .with("album_type", () => Disc3)
    .with("favorite", () => Heart)
    .with("year", () => CalendarRange)
    .with("explicit", () => ExplicitIcon)
    .with("duration", () => Timer)
    .with("last_played", () => History)
    .otherwise(() => Ban);
}
