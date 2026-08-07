<template>
  <EditorialShelf
    :title="title"
    :provider="provider"
    :dimmed="dimmed"
    :tiles-per-view="tilesPerView"
    :gap="gap"
  >
    <template #actions>
      <slot name="actions"></slot>
    </template>

    <EditorialMediaCard
      v-for="event in timelineItems"
      :key="event.id"
      :item="event.artist"
    >
      <template #subtitle>
        <span class="timeline-event">
          <component
            :is="EVENT_ICONS[event.eventType]"
            :size="12"
            class="timeline-event__icon"
          />
          <span>{{ event.dateLabel }}</span>
        </span>
      </template>
    </EditorialMediaCard>
  </EditorialShelf>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue";
import type {
  Artist,
  MediaItemTypeOrItemMapping,
  TimelineEvent,
} from "@/plugins/api/interfaces";
import { ArtistEntityType } from "@/plugins/api/interfaces";
import { Cake, Heart, Users, UserMinus } from "@lucide/vue";
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import EditorialShelf from "@/components/discover/EditorialShelf.vue";

const props = defineProps<{
  title: string;
  items: MediaItemTypeOrItemMapping[];
  provider?: string;
  dimmed?: boolean;
  tilesPerView?: number;
  maxDays?: number;
  gap?: number;
}>();

const MAX_DAYS = computed(() => props.maxDays ?? 15);

const EVENT_ICONS: Record<string, Component> = {
  artist_birthdays: Cake,
  artist_memoriam: Heart,
  group_founded: Users,
  group_disbanded: UserMinus,
};

const GROUP_TYPES = new Set<ArtistEntityType>([
  ArtistEntityType.GROUP,
  ArtistEntityType.ORCHESTRA,
  ArtistEntityType.CHOIR,
]);

function mmddOffset(mmdd: string): number {
  const today = new Date();
  const year = today.getUTCFullYear();
  const [mm, dd] = mmdd.split("-").map(Number);
  if (
    !Number.isFinite(mm) ||
    !Number.isFinite(dd) ||
    mm < 1 ||
    mm > 12 ||
    dd < 1 ||
    dd > 31
  ) {
    return Number.NaN;
  }
  const candidates = [
    new Date(Date.UTC(year - 1, mm - 1, dd)),
    new Date(Date.UTC(year, mm - 1, dd)),
    new Date(Date.UTC(year + 1, mm - 1, dd)),
  ];
  const todayMs = Date.UTC(year, today.getUTCMonth(), today.getUTCDate());
  let best = candidates[1];
  let bestDist = Math.abs(best.getTime() - todayMs);
  for (const c of candidates) {
    const dist = Math.abs(c.getTime() - todayMs);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return Math.round((best.getTime() - todayMs) / 86_400_000);
}

function dateLabel(mmdd: string): string {
  const [mm, dd] = mmdd.split("-").map(Number);
  const date = new Date(2000, mm - 1, dd);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

const timelineItems = computed((): TimelineEvent[] => {
  if (!props.items || props.items.length === 0) return [];

  const events: TimelineEvent[] = [];

  for (const item of props.items) {
    if (item.media_type !== "artist") continue;
    const artist = item as Artist;
    const lifeSpan = artist.metadata?.life_span;
    const entityType = artist.metadata?.artist_entity_type;
    if (!lifeSpan) continue;

    const isGroup = entityType !== undefined && GROUP_TYPES.has(entityType);

    if (lifeSpan.begin && lifeSpan.begin.length >= 10) {
      const mmdd = lifeSpan.begin.substring(5, 10);
      const offset = mmddOffset(mmdd);
      if (Math.abs(offset) <= MAX_DAYS.value) {
        events.push({
          id: `${artist.uri}_birth`,
          artist,
          eventType: isGroup ? "group_founded" : "artist_birthdays",
          dateLabel: dateLabel(mmdd),
          offset,
        });
      }
    }

    if (lifeSpan.ended && lifeSpan.end && lifeSpan.end.length >= 10) {
      const mmdd = lifeSpan.end.substring(5, 10);
      const offset = mmddOffset(mmdd);
      if (Math.abs(offset) <= MAX_DAYS.value) {
        events.push({
          id: `${artist.uri}_end`,
          artist,
          eventType: isGroup ? "group_disbanded" : "artist_memoriam",
          dateLabel: dateLabel(mmdd),
          offset,
        });
      }
    }
  }

  return events.sort((a, b) => a.offset - b.offset);
});
</script>

<style scoped>
.timeline-event {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.timeline-event__icon {
  flex-shrink: 0;
  opacity: 0.75;
}
</style>
