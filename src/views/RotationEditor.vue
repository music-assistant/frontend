<template>
  <section class="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6">
    <Empty v-if="loadFailed" class="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RotationIcon />
        </EmptyMedia>
        <EmptyTitle>{{ $t(`${loadFailedKey}_title`) }}</EmptyTitle>
        <EmptyDescription>
          {{ $t(`${loadFailedKey}_text`) }}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" @click="goBack(router, PLAYLISTS)">
          <ArrowLeft class="h-4 w-4" />
          {{ $t("back") }}
        </Button>
      </EmptyContent>
    </Empty>

    <div v-else-if="!loaded" class="flex justify-center py-16">
      <Spinner class="size-8 text-muted-foreground" />
    </div>

    <template v-else>
      <header
        class="flex flex-wrap items-center gap-2"
        data-testid="rotation-top-bar"
      >
        <Button
          variant="ghost-icon"
          size="icon-sm"
          :aria-label="$t('back')"
          @click="goBack(router, PLAYLISTS)"
        >
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <RotationIcon class="h-5 w-5 text-muted-foreground" />
        <Input
          v-model="name"
          data-testid="rotation-name"
          class="min-w-0 flex-1 basis-40"
          :placeholder="$t('rotation.editor.name_placeholder')"
          :aria-label="$t('rotation.editor.name')"
        />
        <DropdownMenu v-if="recipes.length > 0">
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm">
              {{ $t("rotation.editor.recipe") }}
              <ChevronDown class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-80">
            <DropdownMenuItem
              v-for="recipe in recipes"
              :key="recipe.id"
              class="flex flex-col items-start gap-0.5"
              data-testid="rotation-recipe"
              @select="pickRecipe(recipe.id)"
            >
              <span class="text-sm font-medium">{{ recipe.name }}</span>
              <span class="text-xs text-muted-foreground">
                {{ recipe.goal }}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <RotationRoundStatus
          v-if="editorId && roundStatus"
          :status="roundStatus"
          :unit-kind="roundUnitKind"
          @reset="resetRound"
        />
        <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
          <span
            v-if="saveHint"
            class="text-xs text-muted-foreground"
            data-testid="rotation-save-hint"
          >
            {{ saveHint }}
          </span>
          <Button
            variant="outline"
            size="sm"
            @click="goBack(router, PLAYLISTS)"
          >
            {{ $t("cancel") }}
          </Button>
          <Button
            size="sm"
            data-testid="rotation-save"
            :disabled="!canSave"
            @click="onSave"
          >
            {{
              saving ? $t("rotation.editor.saving") : $t("rotation.editor.save")
            }}
          </Button>
        </div>
      </header>

      <div
        data-testid="rotation-body"
        class="flex flex-col gap-6 lg:flex-row lg:items-start"
      >
        <div class="min-w-0 lg:flex-1">
          <RotationStepList
            v-if="describe"
            :steps="steps"
            :states="rowStates"
            :describe="describe"
            :counts="counts"
            :errors="errors"
            :can-add="canAddStep"
            @update="updateStep"
            @remove="removeStep"
            @move="moveStep"
            @add="addStep"
          />
        </div>
        <div class="min-w-0 lg:flex-1">
          <RotationPreview
            v-model:include-removed="includeRemoved"
            :preview="preview"
            :loading="previewLoading"
            :limit="previewLimit"
            :has-errors="errors.size > 0"
            @more="showMore"
            @reshuffle="reshuffle"
          />
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import RotationIcon from "@/components/rotation/RotationIcon.vue";
import RotationPreview from "@/components/rotation/RotationPreview.vue";
import RotationRoundStatus from "@/components/rotation/RotationRoundStatus.vue";
import RotationStepList from "@/components/rotation/RotationStepList.vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useRotationEditor } from "@/composables/rotation/useRotationEditor";
import {
  ALBUM_LOOKUP_CACHE_KEY,
  createAlbumLookupCache,
} from "@/composables/rotation/useRotationLibraryHints";
import { listStates, rotationIdOf } from "@/helpers/rotation";
import { goBack } from "@/helpers/navigation";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { ArrowLeft, ChevronDown } from "@lucide/vue";
import { computed, nextTick, onMounted, provide, ref, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from "vue-router";

const PLAYLISTS = { name: "playlists" };

const props = defineProps<{
  rotationId?: string;
}>();

const router = useRouter();
const editorId = computed(() => props.rotationId ?? null);
const {
  name,
  steps,
  describe,
  recipes,
  roundStatus,
  roundUnitKind,
  errors,
  preview,
  previewLoading,
  previewLimit,
  includeRemoved,
  dirty,
  canSave,
  canAddStep,
  loadFailed,
  validationPending,
  saving,
  load,
  applyRecipe,
  addStep,
  updateStep,
  removeStep,
  moveStep,
  showMore,
  reshuffle,
  save,
  resetRound,
  refreshRoundStatus,
} = useRotationEditor(editorId);

// the library hints of the steps share their lookups while the editor is open
provide(ALBUM_LOOKUP_CACHE_KEY, createAlbumLookupCache());

const loaded = ref(false);
// set while the editor navigates on its own, or after the user chose to discard
let leaving = false;
// the id the editor moved to after creating a Rotation; it holds that state already
let createdId: string | null = null;
// resolves the navigation the leave guard holds while the user is asked
let heldNavigation: ((discard: boolean) => void) | undefined;

const rowStates = computed(() => {
  const after = listStates(steps.value);
  return steps.value.map((_, index) => after[index === 0 ? 0 : index - 1]!);
});

const counts = computed(() =>
  steps.value.map((_, index) =>
    preview.value?.step_counts.find((entry) => entry.step === index + 1),
  ),
);

// a new Rotation fails only on the field catalogue, never on a deleted Rotation
const loadFailedKey = computed(() =>
  editorId.value
    ? "rotation.editor.load_failed"
    : "rotation.editor.start_failed",
);

const saveHint = computed(() => {
  if (canSave.value || saving.value) return "";
  if (!name.value.trim()) return $t("rotation.editor.hint_name");
  if (validationPending.value) return $t("rotation.editor.hint_checking");
  if (errors.value.size > 0) return $t("rotation.editor.hint_errors");
  return "";
});

async function onSave() {
  const playlist = await save();
  if (!playlist) return;
  if (editorId.value) {
    // saving changed steps clears the played units, so the counts change
    await refreshRoundStatus();
    return;
  }
  createdId = rotationIdOf(playlist) ?? playlist.item_id;
  leaving = true;
  try {
    await router.replace({
      name: "rotation-edit",
      params: { rotationId: createdId },
    });
  } finally {
    leaving = false;
  }
  await nextTick();
  await refreshRoundStatus();
}

/** Replace the steps with a recipe, after asking when that drops unsaved edits. */
function pickRecipe(id: string) {
  if (!dirty.value) {
    applyRecipe(id);
    return;
  }
  confirmDiscard(() => applyRecipe(id));
}

function confirmDiscard(onConfirm: () => void, onCancel?: () => void) {
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("rotation.editor.discard_title"),
    message: $t("rotation.editor.discard_text"),
    confirmLabel: $t("rotation.editor.discard"),
    onConfirm,
    onCancel,
  });
}

async function loadEditor() {
  loaded.value = false;
  await load();
  loaded.value = true;
}

function guardUnsaved(): boolean | Promise<boolean> {
  if (leaving || loadFailed.value || !dirty.value) return true;
  // one is already waiting for an answer: turn this one away rather than hold
  // both, or the history ends up out of step with the page on screen
  if (heldNavigation) return false;
  // holding it, rather than cancelling it and pushing again on discard, keeps
  // a back navigation a back navigation, without a second entry in the history
  return new Promise<boolean>((resolve) => {
    heldNavigation = resolve;
    confirmDiscard(
      () => {
        // a redirect runs the leave guards of the resumed navigation again,
        // and it must not ask a second time
        leaving = true;
        const stop = router.afterEach(() => {
          stop();
          leaving = false;
        });
        releaseNavigation(true);
      },
      () => releaseNavigation(false),
    );
  });
}

function releaseNavigation(discard: boolean) {
  heldNavigation?.(discard);
  heldNavigation = undefined;
}
// moving to another Rotation keeps this view, so that is a route update
onBeforeRouteLeave(guardUnsaved);
onBeforeRouteUpdate(guardUnsaved);

watch(editorId, (id) => {
  if (id !== null && id === createdId) {
    createdId = null;
    return;
  }
  void loadEditor();
});

onMounted(loadEditor);
</script>
