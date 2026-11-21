<template>
  <Card class="gap-4">
    <!-- One ask at a time, and it is what the user is waiting on, so it is what
         gets announced when it changes. -->
    <CardHeader
      ref="header"
      role="status"
      aria-live="polite"
      tabindex="-1"
      class="outline-none"
    >
      <CardTitle>{{
        $t(`${KEYS}.walk.step.${step}.title`, promptValues)
      }}</CardTitle>
      <CardDescription>
        {{ $t(`${KEYS}.walk.step.${step}.description`, promptValues) }}
      </CardDescription>
    </CardHeader>

    <CardContent class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <Button
          v-for="target in targets"
          :key="target.playerId"
          :variant="target.asked ? 'default' : 'outline'"
          class="h-auto min-h-16 w-full justify-start gap-3 px-4 py-3 text-left whitespace-normal has-[>svg]:px-4"
          :disabled="disabled || closed"
          @click="emit('measure', target.playerId, false)"
        >
          <!-- Ahead of the name so the button announces as an action rather than
               as a speaker that happens to be pressable. -->
          <span class="sr-only">
            {{ $t(`${KEYS}.walk.${target.reading ? "again" : "measure"}`) }}
          </span>
          <Spinner
            v-if="measuring === target.playerId"
            class="size-5 shrink-0"
            aria-hidden="true"
          />
          <Check
            v-else-if="target.reading"
            class="size-5 shrink-0"
            aria-hidden="true"
          />
          <Mic v-else class="size-5 shrink-0" aria-hidden="true" />

          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-base leading-tight font-medium">
              {{ target.name }}
            </span>
            <span class="text-sm font-normal opacity-80">
              {{
                target.reading
                  ? $t(`${KEYS}.walk.found`, [
                      target.reading.found,
                      target.reading.expected,
                    ])
                  : $t(`${KEYS}.walk.not_measured`)
              }}
            </span>
            <!-- A tick alone reads as finished; a measured speaker can still be
                 measured again, and the closing steps ask for exactly that. -->
            <span
              v-if="target.reading && !closed"
              class="text-xs font-normal opacity-70"
            >
              {{ $t(`${KEYS}.walk.again_hint`) }}
            </span>
          </span>

          <Badge
            v-if="target.confidence"
            :variant="CONFIDENCE_VARIANT[target.confidence]"
            class="shrink-0"
          >
            {{ $t(`${KEYS}.confidence.${target.confidence}`) }}
          </Badge>
        </Button>
      </div>

      <!-- What to do about a reading that came out badly, while the user is
           still standing where they took it. Taking it again replaces it: a poor
           reading left in would go on pulling at the result. -->
      <Alert v-if="retry && !measuring && !closed" variant="warning">
        <TriangleAlert class="h-4 w-4" aria-hidden="true" />
        <AlertTitle>
          {{ $t(`${KEYS}.walk.retry.${retry.confidence}`, [retry.name]) }}
        </AlertTitle>
        <AlertDescription class="space-y-2">
          <p>{{ $t(`${KEYS}.walk.retry.advice`) }}</p>
          <Button
            size="sm"
            variant="outline"
            :disabled="disabled"
            @click="emit('measure', retry.playerId, true)"
          >
            {{ $t(`${KEYS}.walk.retry.action`, [retry.name]) }}
          </Button>
        </AlertDescription>
      </Alert>

      <!-- Deliberately not a live region: the countdown would talk over the
           screen reader for the whole recording. -->
      <p class="text-sm text-muted-foreground">
        {{ $t(guidance.key, guidance.values) }}
      </p>
    </CardContent>

    <!-- Always within reach: the house is silent for as long as this card is up,
         and leaving the page must not be the only way to end that. -->
    <CardFooter class="flex-col items-stretch gap-2 sm:flex-row">
      <Button variant="outline" :disabled="disabled" @click="emit('stop')">
        <Square class="size-4" aria-hidden="true" />
        {{ $t(`${KEYS}.walk.stop`) }}
      </Button>
      <Button
        v-if="visits.length && !closed"
        variant="ghost"
        :disabled="disabled"
        @click="emit('clear')"
      >
        <RotateCcw class="size-4" aria-hidden="true" />
        {{ $t(`${KEYS}.walk.clear`) }}
      </Button>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, type BadgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { Measurement } from "@/composables/sendspin-sync/useCalibrationRun";
import {
  measurementConfidence,
  type Confidence,
} from "@/helpers/sendspin-sync/confidence";
import type { CalibrationPlayer } from "@/plugins/api/interfaces";
import { Check, Mic, RotateCcw, Square, TriangleAlert } from "@lucide/vue";
import { computed, onMounted, useTemplateRef } from "vue";

const KEYS = "providers.sendspin.calibration";

const CONFIDENCE_VARIANT: Record<Confidence, BadgeVariants["variant"]> = {
  good: "default",
  weak: "warning",
  poor: "destructive",
};

/** Where the walk has got to, which is the one thing the screen asks for. */
type Step = "start" | "next" | "repeat" | "check" | "done";

const {
  players,
  selected,
  visits,
  anchor,
  needsBracket,
  needsCheck,
  disabled,
  measuring,
  secondsLeft = 0,
  closed = false,
} = defineProps<{
  players: CalibrationPlayer[];
  selected: string[];
  visits: Measurement[];
  /** The speaker measured first, which the repeat is asked of. */
  anchor: string | null;
  needsBracket: boolean;
  needsCheck: boolean;
  disabled: boolean;
  /** The speaker currently being recorded, if any. */
  measuring: string | null;
  /** Seconds left of the reading in progress. */
  secondsLeft?: number;
  /**
   * True once the delays were applied: a reading taken now is of corrected
   * speakers, and would not belong with the ones the correction came from.
   */
  closed?: boolean;
}>();

const emit = defineEmits<{
  /** `replace` takes the speaker's latest reading out before the new one goes in. */
  measure: [playerId: string, replace: boolean];
  stop: [];
  clear: [];
}>();

// The picker this card replaces took the focus with it, and a keyboard or
// screen reader user would otherwise be left at the top of the page.
const header = useTemplateRef<{ $el: HTMLElement }>("header");
onMounted(() => header.value?.$el?.focus?.());

const names = computed(
  () => new Map(players.map((player) => [player.player_id, player.name])),
);

function nameOf(playerId: string): string {
  return names.value.get(playerId) ?? playerId;
}

/** The most recent reading of each speaker, by player id. */
const readings = computed(() => {
  const latest = new Map<string, Measurement>();
  for (const visit of visits) latest.set(visit.playerId, visit);
  return latest;
});

/**
 * The speaker to repeat once the clock rate is pinned but untested.
 *
 * The earliest measured of those still read only once, because the second
 * reading has to sit far enough from the first to say anything: the same reason
 * the walk asks for the anchor at the end rather than in the middle.
 */
const checkTarget = computed(() => {
  const counts = new Map<string, number>();
  for (const visit of visits)
    counts.set(visit.playerId, (counts.get(visit.playerId) ?? 0) + 1);
  return (
    visits.find((visit) => counts.get(visit.playerId) === 1)?.playerId ?? null
  );
});

const step = computed<Step>(() => {
  if (!visits.length) return "start";
  if (selected.some((playerId) => !readings.value.has(playerId))) return "next";
  if (needsBracket && anchor) return "repeat";
  if (needsCheck && checkTarget.value) return "check";
  return "done";
});

/**
 * The reading just taken, when it came out badly enough to take again.
 *
 * Only the latest one: it is the speaker the user is standing at, and the only
 * one they can do anything about without walking back.
 */
const retry = computed(() => {
  const latest = visits[visits.length - 1];
  if (!latest) return null;
  const confidence = measurementConfidence(latest);
  if (confidence === "good") return null;
  return {
    playerId: latest.playerId,
    name: nameOf(latest.playerId),
    confidence,
  };
});

/** The line under the speakers: what to do now, or how long is left of doing it. */
const guidance = computed<{ key: string; values: unknown[] }>(() => {
  if (closed) return { key: `${KEYS}.walk.closed`, values: [] };
  if (!measuring) return { key: `${KEYS}.walk.how`, values: [] };
  return secondsLeft > 0
    ? { key: `${KEYS}.walk.listening_left`, values: [secondsLeft] }
    : { key: `${KEYS}.walk.listening`, values: [] };
});

/** The speaker the current step names, if it names one. */
const asked = computed(() => {
  switch (step.value) {
    case "repeat":
      return anchor;
    case "check":
      return checkTarget.value;
    default:
      return null;
  }
});

/** What the current step's wording has to fill in. */
const promptValues = computed(() =>
  step.value === "next"
    ? [readings.value.size, selected.length]
    : [asked.value ? nameOf(asked.value) : ""],
);

/**
 * One button per speaker, in the order they were picked.
 *
 * `asked` marks the speakers this step is asking for, which is the only thing
 * the emphasis means — every speaker stays pressable at every step, because
 * going out of order measures perfectly well and re-measuring is what the
 * closing steps ask for outright.
 */
const targets = computed(() =>
  selected.map((playerId) => {
    const reading = readings.value.get(playerId) ?? null;
    return {
      playerId,
      name: nameOf(playerId),
      reading,
      confidence: reading ? measurementConfidence(reading) : null,
      asked:
        asked.value === null
          ? step.value !== "done" && !reading
          : asked.value === playerId,
    };
  }),
);
</script>
