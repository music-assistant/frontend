<template>
  <section
    class="bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-sm"
    data-testid="music-quiz-playback-controls"
    :aria-busy="loading"
  >
    <div class="flex flex-col gap-1">
      <h3 class="font-semibold">
        {{ $t("providers.music_quiz.playback") }}
      </h3>
      <p class="text-muted-foreground text-sm">
        {{ $t("providers.music_quiz.playback_help") }}
      </p>
    </div>

    <div
      v-if="loading"
      class="text-muted-foreground flex min-h-16 items-center justify-center gap-2 text-sm"
      role="status"
      aria-live="polite"
      data-testid="music-quiz-playback-loading"
    >
      <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
      {{ $t("providers.music_quiz.loading_playback_options") }}
    </div>

    <div
      v-else-if="error && !options"
      class="border-destructive/40 bg-destructive/5 flex flex-col items-start gap-3 rounded-lg border p-3"
      role="alert"
      data-testid="music-quiz-playback-error"
    >
      <div class="flex items-start gap-2">
        <TriangleAlert
          class="text-destructive mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <p class="text-sm">
          {{ $t("providers.music_quiz.playback_options_unavailable") }}
        </p>
      </div>
      <Button variant="outline" size="sm" type="button" @click="emit('retry')">
        <RefreshCw class="size-4" aria-hidden="true" />
        {{ $t("settings.retry") }}
      </Button>
    </div>

    <template v-else-if="options">
      <FieldSet class="gap-4">
        <FieldLegend variant="label" class="sr-only">
          {{ $t("providers.music_quiz.playback_mode") }}
        </FieldLegend>
        <RadioGroup
          :model-value="modelValue.mode ?? undefined"
          class="grid gap-3 sm:grid-cols-2"
          :disabled="disabled"
          @update:model-value="updateMode"
        >
          <label
            for="music-quiz-playback-venue"
            class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-lg border p-3 transition-colors"
            :class="modeCardClasses('venue', venueAvailable)"
          >
            <RadioGroupItem
              id="music-quiz-playback-venue"
              value="venue"
              class="rounded-[4px] data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary dark:data-[state=unchecked]:bg-transparent"
              :disabled="disabled || !venueAvailable"
              aria-describedby="music-quiz-playback-venue-description"
            >
              <Check
                class="absolute top-1/2 left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2"
              />
            </RadioGroupItem>
            <span class="min-w-0 font-medium">
              {{ $t("providers.music_quiz.playback_venue") }}
            </span>
            <span
              id="music-quiz-playback-venue-description"
              class="text-muted-foreground col-start-2 text-sm"
            >
              {{ $t("providers.music_quiz.playback_venue_help") }}
            </span>
            <span
              v-if="!venueAvailable"
              class="text-destructive col-start-2 text-xs"
              data-testid="music-quiz-venue-unavailable"
            >
              {{ venueUnavailableReason }}
            </span>
          </label>

          <label
            for="music-quiz-playback-remote"
            class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-lg border p-3 transition-colors"
            :class="modeCardClasses('remote', options.remote_available)"
          >
            <RadioGroupItem
              id="music-quiz-playback-remote"
              value="remote"
              class="rounded-[4px] data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary dark:data-[state=unchecked]:bg-transparent"
              :disabled="disabled || !options.remote_available"
              aria-describedby="music-quiz-playback-remote-description"
            >
              <Check
                class="absolute top-1/2 left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2"
              />
            </RadioGroupItem>
            <span class="min-w-0 font-medium">
              {{ $t("providers.music_quiz.playback_remote") }}
            </span>
            <span
              id="music-quiz-playback-remote-description"
              class="text-muted-foreground col-start-2 text-sm"
            >
              {{ $t("providers.music_quiz.playback_remote_help") }}
            </span>
            <span
              v-if="!options.remote_available"
              class="text-destructive col-start-2 text-xs"
              data-testid="music-quiz-remote-unavailable"
            >
              {{ $t("providers.music_quiz.playback_remote_unavailable") }}
            </span>
          </label>
        </RadioGroup>
      </FieldSet>

      <Field v-if="modelValue.mode === 'venue'">
        <FieldLabel for="music-quiz-venue-player">
          {{ $t("providers.music_quiz.player") }}
        </FieldLabel>
        <Select v-model="venuePlayerId" :disabled="disabled || !venueAvailable">
          <SelectTrigger
            id="music-quiz-venue-player"
            class="w-full"
            :aria-invalid="!disabled && venueAvailable && !venueSelectionValid"
          >
            <SelectValue
              :placeholder="$t('providers.music_quiz.choose_player')"
            >
              {{ venuePlayerName ?? $t("providers.music_quiz.choose_player") }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="player in options.venue_players"
              :key="player.player_id"
              :value="player.player_id"
            >
              {{ player.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <p
        v-if="!hasAvailableMode"
        class="text-destructive text-sm"
        role="alert"
        data-testid="music-quiz-no-playback-modes"
      >
        {{ $t("providers.music_quiz.no_playback_modes") }}
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  MusicQuizMode,
  MusicQuizPlaybackOptions,
} from "@/composables/music-quiz/useMusicQuiz";
import type { MusicQuizPlaybackSelection } from "@/helpers/music_quiz_playback";
import { $t } from "@/plugins/i18n";
import { Check, LoaderCircle, RefreshCw, TriangleAlert } from "@lucide/vue";
import type { AcceptableValue } from "reka-ui";
import { computed } from "vue";

const props = defineProps<{
  modelValue: MusicQuizPlaybackSelection;
  options: MusicQuizPlaybackOptions | null;
  loading: boolean;
  error: boolean;
  disabled: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [selection: MusicQuizPlaybackSelection];
  retry: [];
}>();

const venueAvailable = computed(
  () =>
    !!props.options?.venue_available && props.options.venue_players.length > 0,
);
const hasAvailableMode = computed(
  () => venueAvailable.value || !!props.options?.remote_available,
);
const venueSelectionValid = computed(
  () =>
    !!props.modelValue.venuePlayerId &&
    !!props.options?.venue_players.some(
      (player) => player.player_id === props.modelValue.venuePlayerId,
    ),
);
const venuePlayerId = computed({
  get: () => props.modelValue.venuePlayerId ?? undefined,
  set: (value: AcceptableValue) => updateVenuePlayer(value),
});
const venuePlayerName = computed(
  () =>
    props.options?.venue_players.find(
      (player) => player.player_id === props.modelValue.venuePlayerId,
    )?.name,
);
const venueUnavailableReason = computed(() =>
  props.options?.venue_players.length === 0
    ? $t("providers.music_quiz.no_available_players")
    : $t("providers.music_quiz.playback_venue_unavailable"),
);

function updateMode(value: AcceptableValue) {
  if (value !== "venue" && value !== "remote") return;
  emit("update:modelValue", {
    ...props.modelValue,
    mode: value,
  });
}

function updateVenuePlayer(value: AcceptableValue) {
  emit("update:modelValue", {
    ...props.modelValue,
    venuePlayerId: typeof value === "string" && value ? value : null,
  });
}

function modeCardClasses(mode: MusicQuizMode, available: boolean) {
  if (!available) return "cursor-not-allowed bg-muted/30 opacity-70";
  return props.modelValue.mode === mode
    ? "border-primary bg-primary/5 cursor-pointer"
    : "hover:border-primary/50 cursor-pointer";
}
</script>
