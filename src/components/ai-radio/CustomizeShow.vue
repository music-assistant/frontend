<template>
  <div class="space-y-6">
    <header class="flex items-center gap-3">
      <Button
        variant="ghost-icon"
        size="icon-sm"
        :aria-label="$t('back')"
        @click="handleBack"
      >
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <div class="min-w-0 flex-1">
        <p class="text-xs text-muted-foreground">
          {{ $t("providers.ai_radio.customize.title") }}
        </p>
        <h1 class="truncate text-xl font-semibold tracking-tight">
          {{ draft?.basics.name || $t("providers.ai_radio.customize.title") }}
        </h1>
      </div>
      <Button :disabled="!draft || saving" @click="handleSave">
        {{
          saving
            ? $t("providers.ai_radio.actions.saving")
            : $t("providers.ai_radio.customize.save")
        }}
      </Button>
    </header>

    <div v-if="loading" class="flex justify-center py-16">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <div
      v-else-if="!draft"
      class="rounded-xl border border-dashed py-16 text-center"
    >
      <p class="text-sm text-muted-foreground">{{ loadError }}</p>
      <Button variant="outline" class="mt-4" @click="emit('back')">
        {{ $t("back") }}
      </Button>
    </div>

    <template v-else>
      <Alert v-if="lossy" variant="warning">
        <TriangleAlert class="h-4 w-4" />
        <AlertTitle>
          {{ $t("providers.ai_radio.customize.lossy_warning_title") }}
        </AlertTitle>
        <AlertDescription>
          {{ $t("providers.ai_radio.customize.lossy_warning_description") }}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{{
            $t("providers.ai_radio.customize.basics_title")
          }}</CardTitle>
        </CardHeader>
        <CardContent class="grid gap-4 md:grid-cols-2">
          <div class="flex flex-col gap-1.5 md:col-span-2">
            <Label for="customize-show-name">
              {{ $t("providers.ai_radio.create.name_label") }}
            </Label>
            <Input id="customize-show-name" v-model="draft.basics.name" />
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>{{ $t("providers.ai_radio.create.playlist_label") }}</Label>
            <AiRadioPlaylistPicker v-model="playlistSelection" />
          </div>

          <div class="flex flex-col gap-1.5">
            <Label for="customize-default-player">
              {{ $t("providers.ai_radio.fields.default_playback_device") }}
            </Label>
            <Select v-model="defaultPlayerSelectValue">
              <SelectTrigger id="customize-default-player" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NONE_SELECT_VALUE">
                  {{ $t("providers.ai_radio.customize.use_current_player") }}
                </SelectItem>
                <SelectItem
                  v-for="player in orderedPlayers"
                  :key="player.player_id"
                  :value="player.player_id"
                >
                  {{ player.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex-row items-center justify-between space-y-0">
          <CardTitle>
            {{ $t("providers.ai_radio.customize.segments_title") }}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="sm">
                <Plus class="h-4 w-4" />
                {{ $t("providers.ai_radio.customize.add_segment") }}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="max-h-80 overflow-y-auto">
              <DropdownMenuItem @click="addBlankSegment">
                {{ $t("providers.ai_radio.customize.blank_segment") }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <template v-for="preset in PRESETS" :key="preset.key">
                <DropdownMenuLabel class="text-xs text-muted-foreground">
                  {{ $t(`providers.ai_radio.presets.${preset.key}.name`) }}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  v-for="segment in preset.segments"
                  :key="segment.id"
                  @click="addSegmentFromTemplate(segment)"
                >
                  {{ segment.name }}
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent class="space-y-2">
          <p
            v-if="draft.segments.length === 0"
            class="py-6 text-center text-sm text-muted-foreground"
          >
            {{ $t("providers.ai_radio.customize.segments_empty") }}
          </p>
          <SegmentRow
            v-for="(segment, index) in draft.segments"
            :key="segment.id"
            :segment="segment"
            :can-move-up="index > 0"
            :can-move-down="index < draft.segments.length - 1"
            @update="(value) => updateSegment(index, value)"
            @move-up="moveSegment(index, -1)"
            @move-down="moveSegment(index, 1)"
            @remove="removeSegment(index)"
          />
        </CardContent>
      </Card>

      <Accordion type="single" collapsible>
        <AccordionItem value="advanced" class="rounded-lg border px-4">
          <AccordionTrigger>
            {{ $t("providers.ai_radio.customize.advanced") }}
          </AccordionTrigger>
          <AccordionContent class="grid gap-4 pt-2 md:grid-cols-2">
            <div class="flex flex-col gap-1.5 md:col-span-2">
              <Label>{{ $t("providers.ai_radio.fields.instructions") }}</Label>
              <Textarea v-model="draft.basics.general.instructions" rows="4" />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>{{ $t("providers.ai_radio.fields.weather_city") }}</Label>
              <Input v-model="draft.basics.general.location.city" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>{{
                $t("providers.ai_radio.fields.weather_country")
              }}</Label>
              <Input v-model="draft.basics.general.location.country" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>{{ $t("providers.ai_radio.fields.timezone") }}</Label>
              <Input v-model="draft.basics.general.timezone" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>
                {{ $t("providers.ai_radio.fields.target_playlist_provider") }}
              </Label>
              <Input v-model="draft.basics.targetPlaylistProvider" />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>
                {{ $t("providers.ai_radio.fields.source_playtime_cap") }}
              </Label>
              <NumberField v-model="draft.basics.maxDurationMinutes" :min="0">
                <NumberFieldContent>
                  <NumberFieldDecrement />
                  <NumberFieldInput />
                  <NumberFieldIncrement />
                </NumberFieldContent>
              </NumberField>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>
                {{ $t("providers.ai_radio.fields.dynamic_batch_size") }}
              </Label>
              <NumberField v-model="draft.basics.dynamicBatchSize" :min="1">
                <NumberFieldContent>
                  <NumberFieldDecrement />
                  <NumberFieldInput />
                  <NumberFieldIncrement />
                </NumberFieldContent>
              </NumberField>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>
                {{ $t("providers.ai_radio.fields.dynamic_poll_seconds") }}
              </Label>
              <NumberField v-model="draft.basics.dynamicPollSeconds" :min="1">
                <NumberFieldContent>
                  <NumberFieldDecrement />
                  <NumberFieldInput />
                  <NumberFieldIncrement />
                </NumberFieldContent>
              </NumberField>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>
                {{ $t("providers.ai_radio.fields.dynamic_prefetch_remaining") }}
              </Label>
              <NumberField
                v-model="draft.basics.dynamicPrefetchRemainingTracks"
                :min="1"
              >
                <NumberFieldContent>
                  <NumberFieldDecrement />
                  <NumberFieldInput />
                  <NumberFieldIncrement />
                </NumberFieldContent>
              </NumberField>
            </div>

            <div class="flex items-center justify-between gap-3 md:col-span-2">
              <Label for="customize-clear-queue">
                {{
                  $t("providers.ai_radio.fields.clear_queue_on_dynamic_start")
                }}
              </Label>
              <Switch
                id="customize-clear-queue"
                v-model="draft.basics.clearQueueOnStart"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </template>
  </div>
</template>

<script setup lang="ts">
import AiRadioPlaylistPicker, {
  type PlaylistSelection,
} from "@/components/ai-radio/AiRadioPlaylistPicker.vue";
import SegmentRow from "@/components/ai-radio/SegmentRow.vue";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useOrderedPlayers } from "@/composables/useOrderedPlayers";
import { useShows } from "@/composables/ai-radio/useShows";
import {
  compileShow,
  deepClone,
  decompileStation,
  errorMessage,
  NONE_SELECT_VALUE,
  PRESETS,
  type ShowDraft,
  type ShowSegment,
} from "@/helpers/ai_radio";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { ArrowLeft, Loader2, Plus, TriangleAlert } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { toast } from "vue-sonner";

const props = defineProps<{
  stationId: string;
}>();

const emit = defineEmits<{
  back: [];
  saved: [];
}>();

const router = useRouter();
const { sections, loadSections, getShow, saveShow, playlistFor } = useShows();
const orderedPlayers = useOrderedPlayers();

const loading = ref(true);
const loadError = ref("");
const saving = ref(false);
const lossy = ref(false);
const draft = ref<ShowDraft | null>(null);
let originalSnapshot = "";

const dirty = computed(
  () => !!draft.value && JSON.stringify(draft.value) !== originalSnapshot,
);

const playlistSelection = computed<PlaylistSelection | undefined>({
  get: () => {
    if (!draft.value) return undefined;
    const { sourcePlaylistId, sourcePlaylistProvider } = draft.value.basics;
    if (!sourcePlaylistId) return undefined;
    const playlist = playlistFor(sourcePlaylistProvider, sourcePlaylistId);
    return {
      itemId: sourcePlaylistId,
      provider: sourcePlaylistProvider,
      name: playlist?.name || sourcePlaylistId,
    };
  },
  set: (value) => {
    if (!draft.value || !value) return;
    draft.value.basics.sourcePlaylistId = value.itemId;
    draft.value.basics.sourcePlaylistProvider = value.provider;
  },
});

const defaultPlayerSelectValue = computed({
  get: () => draft.value?.basics.defaultPlayerId || NONE_SELECT_VALUE,
  set: (value: string) => {
    if (!draft.value) return;
    draft.value.basics.defaultPlayerId =
      value === NONE_SELECT_VALUE ? "" : value;
  },
});

function updateSegment(index: number, segment: ShowSegment) {
  draft.value?.segments.splice(index, 1, segment);
}

function moveSegment(index: number, delta: number) {
  if (!draft.value) return;
  const { segments } = draft.value;
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= segments.length) return;
  const [item] = segments.splice(index, 1);
  segments.splice(newIndex, 0, item);
}

function removeSegment(index: number) {
  draft.value?.segments.splice(index, 1);
}

/** Appends numeric suffixes until `id` doesn't collide with an existing draft segment. */
function uniqueSegmentId(id: string): string {
  const used = new Set(draft.value?.segments.map((s) => s.id) || []);
  let candidate = id;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${id}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function addSegmentFromTemplate(template: ShowSegment) {
  if (!draft.value) return;
  draft.value.segments.push({
    ...deepClone(template),
    id: uniqueSegmentId(template.id),
  });
}

function addBlankSegment() {
  if (!draft.value) return;
  draft.value.segments.push({
    id: uniqueSegmentId("segment"),
    name: $t("providers.ai_radio.customize.blank_segment_name"),
    prompt: "",
    webSearch: "disabled",
    maxChars: 500,
    plays: { kind: "every_song" },
  });
}

function confirmDiscard(onConfirm: () => void) {
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("providers.ai_radio.confirm.discard_changes_title"),
    message: $t("providers.ai_radio.confirm.discard_changes"),
    confirmLabel: $t("providers.ai_radio.actions.discard"),
    onConfirm,
  });
}

function handleBack() {
  if (!dirty.value) {
    emit("back");
    return;
  }
  confirmDiscard(() => emit("back"));
}

async function handleSave() {
  if (!draft.value) return;
  saving.value = true;
  try {
    const station = compileShow(draft.value);
    await saveShow(station);
    originalSnapshot = JSON.stringify(draft.value);
    emit("saved");
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

onBeforeRouteLeave((to) => {
  if (!dirty.value) return true;
  confirmDiscard(() => {
    void router.push(to.fullPath);
  });
  return false;
});

onMounted(async () => {
  try {
    if (sections.value.length === 0) {
      await loadSections();
    }
    const station = await getShow(props.stationId);
    const decompiled = decompileStation(station, sections.value);
    draft.value = { basics: decompiled.basics, segments: decompiled.segments };
    lossy.value = decompiled.lossy;
    originalSnapshot = JSON.stringify(draft.value);
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
});
</script>
