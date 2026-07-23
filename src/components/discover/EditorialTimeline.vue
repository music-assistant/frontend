<template>
  <div class="timeline-container" :class="{ dimmed }">
    <div class="timeline-header">
      <div class="timeline-title-row">
        <h2 class="timeline-title">{{ title }}</h2>
        <ProviderIcon
          v-if="provider"
          :domain="provider"
          :size="24"
          class="timeline-provider"
        />
        <slot name="actions"></slot>
      </div>
    </div>

    <!-- Artists in chronological order -->
    <div class="timeline-scroll">
      <div
        ref="track"
        class="timeline-events"
        :style="{
          '--ed-gap': gap + 'px',
          ...(tileArt != null ? { '--ed-tile-art': tileArt + 'px' } : {}),
        }"
      >
        <EditorialMediaCard
          v-for="event in timelineItems"
          :key="event.id"
          :item="event.artist"
          class="timeline-card"
        >
          <template #subtitle>
            <div style="display: flex; align-items: center; gap: 6px">
              <component
                :is="EVENT_ICONS[event.eventType]"
                :size="12"
                style="flex-shrink: 0; opacity: 0.75"
              />
              <span>{{ event.dateLabel }}</span>
            </div>
          </template>
        </EditorialMediaCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from "vue";
import type {
  Artist,
  MediaItemTypeOrItemMapping,
  TimelineEvent,
} from "@/plugins/api/interfaces";
import { ArtistEntityType } from "@/plugins/api/interfaces";
import { Cake, Heart, Users, UserMinus } from "@lucide/vue";
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { getBreakpointValue } from "@/plugins/breakpoint";

const props = defineProps<{
  title: string;
  items: MediaItemTypeOrItemMapping[];
  provider?: string;
  dimmed?: boolean;
  tilesPerView?: number;
  maxDays?: number;
  gap?: number;
}>();

const CARD_PAD = 16;
const PHONE_GAP = 4;
const PHONE_CARD_PAD = 8;
const MIN_ART = 120;
const MAX_ART = 280;

const track = ref<HTMLElement | null>(null);
const tileArt = ref<number | null>(null);

const gap = computed(() => props.gap ?? 14);

const MAX_DAYS = computed(() => props.maxDays ?? 15);

const minDaysLabel = computed(() => {
  const days = MAX_DAYS.value;
  return days === 1 ? "Yesterday" : `${days} days ago`;
});

const maxDaysLabel = computed(() => {
  const days = MAX_DAYS.value;
  return days === 1 ? "Tomorrow" : `in ${days} days`;
});

const EVENT_ICONS: Record<string, unknown> = {
  artist_birthdays: Cake,
  artist_memoriam: Heart,
  group_founded: Users,
  group_disbanded: UserMinus,
};

function fullDate(event: TimelineEvent): string {
  const lifeSpan = event.artist.metadata?.life_span;
  if (!lifeSpan) return event.dateLabel;
  const raw =
    event.eventType === "artist_memoriam" ||
    event.eventType === "group_disbanded"
      ? lifeSpan.end
      : lifeSpan.begin;
  if (!raw || raw.length < 10) return event.dateLabel;
  const [year, month, day] = raw.substring(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

const GROUP_TYPES = new Set<ArtistEntityType>([
  ArtistEntityType.GROUP,
  ArtistEntityType.ORCHESTRA,
  ArtistEntityType.CHOIR,
]);

function mmddOffset(mmdd: string): number {
  const today = new Date();
  const year = today.getUTCFullYear();
  const [mm, dd] = mmdd.split("-").map(Number);
  // Try this year first; if more than 180 days away, try adjacent year.
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

function dateLabel(offset: number, mmdd: string): string {
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  if (offset === 1) return "Tomorrow";
  const [mm, dd] = mmdd.split("-").map(Number);
  const date = new Date(2000, mm - 1, dd);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
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
          dateLabel: dateLabel(offset, mmdd),
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
          dateLabel: dateLabel(offset, mmdd),
          offset,
        });
      }
    }
  }

  return events.sort((a, b) => a.offset - b.offset);
});

const updateTileArt = () => {
  const el = track.value;
  if (!el || !props.tilesPerView || props.tilesPerView <= 0) {
    tileArt.value = null;
    return;
  }
  const isPhone = getBreakpointValue({ breakpoint: "bp1", condition: "lt" });
  const gapVal = isPhone ? Math.min(gap.value, PHONE_GAP) : gap.value;
  const cardPad = isPhone ? PHONE_CARD_PAD : CARD_PAD;
  const size = el.clientWidth / props.tilesPerView - gapVal - cardPad;
  tileArt.value = Math.round(Math.max(MIN_ART, Math.min(MAX_ART, size)));
};

onMounted(() => {
  updateTileArt();
});

watch(() => props.tilesPerView, updateTileArt);
</script>

<style scoped>
.timeline-container {
  --ed-gutter: 28px;
  --ed-card-pad: 8px;
  padding: 16px 0;
}

.timeline-container.dimmed {
  opacity: 0.5;
}

.timeline-header {
  padding: 0 var(--ed-gutter) 16px;
}

.timeline-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.timeline-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  flex: 1;
}

.timeline-provider {
  flex-shrink: 0;
}

.timeline-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;

  /* Hide scrollbar */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.timeline-scroll::-webkit-scrollbar {
  display: none;
}

.timeline-events {
  display: flex;
  gap: var(--ed-gap, 14px);
  padding-left: calc(var(--ed-gutter) - var(--ed-card-pad));
  padding-right: var(--ed-gutter);
  padding-bottom: 16px;
}

.timeline-card {
  flex-shrink: 0;
}

@media (max-width: 600px) {
  .timeline-container {
    --ed-gutter: 16px;
    --ed-card-pad: 4px;
  }
}
</style>
