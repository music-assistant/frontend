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

          <div class="flex flex-col gap-1.5">
            <FieldLabel
              html-for="customize-host-language"
              :label="$t('providers.ai_radio.fields.language')"
            />
            <Select v-model="languageSelectValue">
              <SelectTrigger id="customize-host-language" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NONE_SELECT_VALUE">
                  {{ $t("providers.ai_radio.hosts.editor.default_language") }}
                </SelectItem>
                <SelectItem
                  v-for="option in languageOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
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
              <DropdownMenuItem
                v-for="template in GENERIC_SEGMENT_TEMPLATES"
                :key="template.id"
                @click="addSegmentFromTemplate(template)"
              >
                {{
                  $t(
                    `providers.ai_radio.customize.segment_templates.${template.id}`,
                  )
                }}
              </DropdownMenuItem>
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
import { Textarea } from "@/components/ui/textarea";
import { useHosts } from "@/composables/ai-radio/useHosts";
import { useShows } from "@/composables/ai-radio/useShows";
import {
  compileHost,
  deepClone,
  decompileHost,
  errorMessage,
  GENERIC_HOST_INSTRUCTIONS,
  GENERIC_HOST_SEGMENTS,
  GENERIC_SEGMENT_TEMPLATES,
  NONE_SELECT_VALUE,
  type HostDraft,
  type ShowSegment,
} from "@/helpers/ai_radio";
import { eventbus } from "@/plugins/eventbus";
import { $t, canonicalizeLocale, getLocaleOptions, i18n } from "@/plugins/i18n";
import { ArrowLeft, Loader2, Plus } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { toast } from "vue-sonner";

const props = defineProps<{
  /** Existing host id to edit; omit (or empty) to create a new host. */
  hostId?: string;
  /** Pre-filled unsaved draft to seed a new host from (e.g. a persona preset); ignored when hostId is set. */
  presetDraft?: HostDraft;
}>();

const emit = defineEmits<{
  back: [];
  saved: [];
}>();

const router = useRouter();
const { sections, loadSections } = useShows();
const {
  hosts,
  ttsEngines,
  getHost,
  loadHosts,
  saveSections,
  saveHost,
  loadTtsEngines,
} = useHosts();

const loading = ref(true);
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

// Canonical option values ("el_GR" -> "el-GR") so a stored language matches the
// option it was picked from, and the server receives a BCP-47 tag.
const languageOptions = computed(() =>
  getLocaleOptions(i18n.global.availableLocales, i18n.global.locale.value).map(
    (option) => ({ ...option, value: canonicalizeLocale(option.value) }),
  ),
);

const languageSelectValue = computed({
  get: () => draft.value?.language || NONE_SELECT_VALUE,
  set: (value: string) => {
    if (!draft.value) return;
    draft.value.language = value === NONE_SELECT_VALUE ? "" : value;
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
    name: $t(`providers.ai_radio.customize.segment_templates.${template.id}`),
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

/** Seed for a brand-new host: one generic example segment per placement, no persona. */
function newHostDraft(): HostDraft {
  return {
    id: "",
    name: "",
    instructions: GENERIC_HOST_INSTRUCTIONS,
    ttsEngine: "",
    language: "",
    segments: deepClone(GENERIC_HOST_SEGMENTS),
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

/**
 * Localized reason the draft can't be saved, or null when it can. Runs
 * before any write so a rejected host save can't leave orphaned sections.
 */
function validate(host: HostDraft): string | null {
  const prefix = "providers.ai_radio.hosts.editor.validation";
  if (!host.name.trim()) {
    return $t(`${prefix}.name_required`);
  }
  if (host.segments.length === 0) {
    return $t(`${prefix}.segments_required`);
  }
  if (host.segments.some((segment) => !segment.prompt.trim())) {
    return $t(`${prefix}.segment_prompt_required`);
  }
  return null;
}

async function handleSave() {
  if (!draft.value) return;
  const validationError = validate(draft.value);
  if (validationError) {
    toast.error(validationError);
    return;
  }
  saving.value = true;
  try {
    const { host, sections: compiledSections } = compileHost(draft.value);
    // The server upserts by id (derived from name for new hosts), so a
    // duplicate name would silently overwrite; renames keep their own id.
    if (!props.hostId) {
      try {
        await loadHosts();
      } catch {
        // A stale or empty list could hide a real collision, so an unverifiable
        // name must block the save rather than risk overwriting another host.
        toast.error(
          $t("providers.ai_radio.hosts.editor.validation.name_check_failed"),
        );
        return;
      }
      if (hosts.value.some((existing) => existing.id === host.id)) {
        toast.error(
          $t("providers.ai_radio.hosts.editor.validation.duplicate_name", [
            host.name,
          ]),
        );
        return;
      }
    }
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
    // Best effort: a failed engine list leaves the voice picker at "Default",
    // so tell the user rather than failing silently.
    void loadTtsEngines().catch(() =>
      toast.error($t("providers.ai_radio.toast.tts_engines_load_failed")),
    );
    if (props.hostId) {
      // Always fetch fresh: the shared sections cache can be stale right
      // after a save (edit -> save -> reopen must not decompile old content).
      await loadSections();
      const host = await getHost(props.hostId);
      draft.value = decompileHost(host, sections.value);
    } else {
      draft.value = props.presetDraft
        ? deepClone(props.presetDraft)
        : newHostDraft();
    }
    originalSnapshot = JSON.stringify(draft.value);
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
});
</script>
