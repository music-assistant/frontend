<template>
  <!-- A playlist offered ready to go; only shown when it can be found. -->
  <section
    v-if="suggestion"
    class="flex flex-col gap-2"
    data-testid="music-quiz-suggested-source"
  >
    <h3 class="text-muted-foreground text-sm font-medium">
      {{ $t("providers.music_quiz.setup_suggested") }}
    </h3>
    <button
      type="button"
      class="hover:border-primary focus-visible:ring-ring bg-card grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-100"
      :class="{ 'border-primary bg-primary/5': added }"
      :aria-disabled="added || disabled || undefined"
      :aria-pressed="added"
      :aria-label="
        $t('providers.music_quiz.setup_suggestion_add', [suggestion.name])
      "
      data-testid="music-quiz-suggested-source-add"
      @click="add"
    >
      <img
        v-if="imageUrl"
        :src="imageUrl"
        alt=""
        class="bg-muted aspect-square w-full rounded-lg object-cover"
      />
      <span
        v-else
        class="bg-muted text-muted-foreground grid aspect-square w-full place-items-center rounded-lg"
        aria-hidden="true"
      >
        <ListMusic class="size-6" />
      </span>
      <span class="flex min-w-0 flex-col gap-0.5">
        <strong class="truncate">{{ suggestion.name }}</strong>
        <span class="text-muted-foreground truncate text-sm">
          {{ $t("providers.music_quiz.setup_suggested_testing") }}
        </span>
      </span>
      <Check v-if="added" class="text-primary size-5" aria-hidden="true" />
      <Plus v-else class="text-primary size-5" aria-hidden="true" />
    </button>
    <!-- Stays focusable once added (disabling it would drop focus); this says
         it worked. -->
    <p class="sr-only" role="status">
      {{
        added
          ? $t("providers.music_quiz.setup_suggestion_added_named", [
              suggestion.name,
            ])
          : ""
      }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { getImageThumbForItem } from "@/helpers/utils";
import api from "@/plugins/api";
import { MediaType, type Playlist } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Check, ListMusic, Plus } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";

/**
 * The playlist suggested for testing: Spotify's "Blind Test - 80s / 90s /
 * 00s / 10s / 20s". It's looked up by search, so it shows on any server with
 * Spotify and stays hidden where it can't be found.
 */
const SUGGESTION = {
  search: "Blind Test 80s 90s 00s 10s 20s",
  spotifyPlaylistId: "0EFdkYy5imXOa9hgaRozM3",
  namePrefix: "blind test",
};

const props = defineProps<{ selectedUris: string[]; disabled?: boolean }>();
const emit = defineEmits<{ add: [playlist: Playlist] }>();

const suggestion = ref<Playlist | null>(null);
const added = computed(
  () => !!suggestion.value && props.selectedUris.includes(suggestion.value.uri),
);
const imageUrl = computed(() =>
  suggestion.value ? getImageThumbForItem(suggestion.value) : undefined,
);

function add() {
  if (!suggestion.value || added.value || props.disabled) return;
  emit("add", suggestion.value);
}

onMounted(async () => {
  try {
    const results = await api.search(
      SUGGESTION.search,
      [MediaType.PLAYLIST],
      8,
    );
    const playlists = results.playlists ?? [];
    suggestion.value =
      playlists.find((playlist) =>
        playlist.uri.endsWith(`/playlist/${SUGGESTION.spotifyPlaylistId}`),
      ) ??
      playlists.find((playlist) =>
        playlist.name.toLowerCase().startsWith(SUGGESTION.namePrefix),
      ) ??
      null;
  } catch {
    // No suggestion is fine; the search below still works.
    suggestion.value = null;
  }
});
</script>
