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
          {{ $t("providers.ai_radio.hosts.editor.title") }}
        </p>
        <h1 class="truncate text-xl font-semibold tracking-tight">
          {{ draft?.name || $t("providers.ai_radio.hosts.editor.title") }}
        </h1>
      </div>
      <Button :disabled="!draft || saving" @click="handleSave">
        {{
          saving
            ? $t("providers.ai_radio.actions.saving")
            : $t("providers.ai_radio.hosts.editor.save")
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
      <Card class="rounded-[6px]">
        <CardHeader>
          <CardTitle>{{
            $t("providers.ai_radio.customize.basics_title")
          }}</CardTitle>
        </CardHeader>
        <CardContent class="grid gap-4 md:grid-cols-2">
          <div class="flex flex-col gap-1.5 md:col-span-2">
            <Label for="customize-host-name">
              {{ $t("providers.ai_radio.hosts.editor.name_label") }}
            </Label>
            <Input id="customize-host-name" v-model="draft.name" />
          </div>

          <div class="flex flex-col gap-1.5 md:col-span-2">
            <FieldLabel
              :label="$t('providers.ai_radio.fields.instructions')"
              :description="
                $t('providers.ai_radio.field_descriptions.instructions')
              "
            />
            <Textarea v-model="draft.instructions" rows="4" />
          </div>

          <div class="flex flex-col gap-1.5">
            <FieldLabel
              html-for="customize-host-voice"
              :label="$t('providers.ai_radio.fields.voice')"
            />
            <Select v-model="voiceSelectValue">
              <SelectTrigger id="customize-host-voice" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NONE_SELECT_VALUE">
                  {{ $t("providers.ai_radio.hosts.editor.default_voice") }}
                </SelectItem>
                <SelectItem
                  v-for="engine in ttsEngines"
                  :key="engine.uid"
                  :value="engine.uid"
                >
                  {{ engine.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card class="rounded-[6px]">
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

      <Card class="rounded-[6px]">
        <CardHeader>
          <CardTitle>{{
            $t("providers.ai_radio.create.talk_label")
          }}</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <Slider
            :model-value="[talkLevelIndex]"
            :min="0"
            :max="2"
            :step="1"
            @update:model-value="onTalkSlider"
          />
          <div class="flex justify-between text-xs text-muted-foreground">
            <span
              v-for="level in TALK_LEVELS"
              :key="level"
              :class="{
                'font-medium text-foreground': draft.talkativeness === level,
              }"
            >
              {{ $t(`providers.ai_radio.talk.${level}`) }}
            </span>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>

<script setup lang="ts">
import FieldLabel from "@/components/ai-radio/FieldLabel.vue";
import SegmentRow from "@/components/ai-radio/SegmentRow.vue";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useHosts } from "@/composables/ai-radio/useHosts";
import { useShows } from "@/composables/ai-radio/useShows";
import {
  compileHost,
  deepClone,
  decompileHost,
  errorMessage,
  NONE_SELECT_VALUE,
  PRESETS,
  type HostDraft,
  type ShowSegment,
  type TalkativenessLevel,
} from "@/helpers/ai_radio";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { ArrowLeft, Loader2, Plus } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { toast } from "vue-sonner";

const props = defineProps<{
  /** Existing host id to edit; omit (or empty) to create a new host. */
  hostId?: string;
}>();

const emit = defineEmits<{
  back: [];
  saved: [];
}>();

const TALK_LEVELS: TalkativenessLevel[] = ["rarely", "normal", "chatty"];

const router = useRouter();
const { sections, loadSections } = useShows();
const { ttsEngines, getHost, saveSections, saveHost, loadTtsEngines } =
  useHosts();

const loading = ref(!!props.hostId);
const loadError = ref("");
const saving = ref(false);
const draft = ref<HostDraft | null>(null);
let originalSnapshot = "";

const dirty = computed(
  () => !!draft.value && JSON.stringify(draft.value) !== originalSnapshot,
);

const voiceSelectValue = computed({
  get: () => draft.value?.ttsEngine || NONE_SELECT_VALUE,
  set: (value: string) => {
    if (!draft.value) return;
    draft.value.ttsEngine = value === NONE_SELECT_VALUE ? "" : value;
  },
});

const talkLevelIndex = computed(() =>
  draft.value ? TALK_LEVELS.indexOf(draft.value.talkativeness) : 1,
);

function onTalkSlider(value: number[] | undefined) {
  if (!draft.value) return;
  draft.value.talkativeness = TALK_LEVELS[value?.[0] ?? 1] ?? "normal";
}

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

/** Seed for a brand-new host: the first preset's persona and segments, like the show create dialog. */
function newHostDraft(): HostDraft {
  const preset = PRESETS[0];
  return {
    id: "",
    name: "",
    instructions: preset.instructions,
    ttsEngine: "",
    segments: deepClone(preset.segments),
    talkativeness: "normal",
  };
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
    const { host, sections: compiledSections } = compileHost(draft.value);
    await saveSections(compiledSections);
    await saveHost(host);
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
    void loadTtsEngines();
    if (props.hostId) {
      if (sections.value.length === 0) {
        await loadSections();
      }
      const host = await getHost(props.hostId);
      draft.value = decompileHost(host, sections.value);
    } else {
      draft.value = newHostDraft();
    }
    originalSnapshot = JSON.stringify(draft.value);
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
});
</script>
