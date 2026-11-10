import {
  addableStepTypes,
  groupKind,
  listStates,
  moveStep as moveStepIn,
  newStep,
  unitKind,
  type ItemKind,
} from "@/helpers/rotation";
import api from "@/plugins/api";
import type {
  Playlist,
  RotationDescribe,
  RotationInfo,
  RotationPreview,
  RotationRecipe,
  RotationStep,
  RotationStepError,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import { toast } from "vue-sonner";

export const MAX_STEPS = 30;
export const PREVIEW_DEBOUNCE_MS = 400;
export const PREVIEW_LIMIT_DEFAULT = 20;
export const PREVIEW_LIMIT_STEP = 20;
export const PREVIEW_LIMIT_MAX = 200;
const SEED_RANGE = 2 ** 31;

type ExpandTarget = Extract<RotationStep, { type: "expand" }>["to"];

function randomSeed(): number {
  return Math.floor(Math.random() * SEED_RANGE);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useRotationEditor(rotationId: Ref<string | null>) {
  const name = ref("");
  const steps = ref<RotationStep[]>([]);
  const describe = ref<RotationDescribe | null>(null);
  const recipes = ref<RotationRecipe[]>([]);
  const roundStatus = ref<RotationInfo["round_status"] | null>(null);
  const validationErrors = ref<RotationStepError[]>([]);
  const preview = ref<RotationPreview | null>(null);
  const previewLoading = ref(false);
  const previewLimit = ref(PREVIEW_LIMIT_DEFAULT);
  const includeRemoved = ref(false);
  const saving = ref(false);
  const seed = ref(randomSeed());
  const snapshot = ref("");
  const loadFailed = ref(false);
  // what the round counts, taken from the saved steps the server counts with
  const roundUnitKind = ref<ItemKind>("album");
  const validationPending = ref(false);

  let requestCounter = 0;
  let stepsVersion = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const errors = computed(() => {
    const map = new Map<number, RotationStepError[]>();
    for (const error of validationErrors.value) {
      const list = map.get(error.step) ?? [];
      list.push(error);
      map.set(error.step, list);
    }
    return map;
  });

  const currentSnapshot = (): string =>
    JSON.stringify({ name: name.value, steps: steps.value });
  const dirty = computed(() => currentSnapshot() !== snapshot.value);
  const canSave = computed(
    () =>
      name.value.trim().length > 0 &&
      errors.value.size === 0 &&
      !validationPending.value &&
      !saving.value,
  );
  const canAddStep = computed(() => steps.value.length < MAX_STEPS);

  async function runPreview(): Promise<void> {
    const requestId = ++requestCounter;
    const version = stepsVersion;
    previewLoading.value = true;
    try {
      const found = await api.validateRotation(steps.value);
      if (requestId !== requestCounter) return;
      validationErrors.value = found;
      if (version === stepsVersion) validationPending.value = false;
      if (found.length > 0) {
        preview.value = null;
        previewLoading.value = false;
        return;
      }
      const result = await api.previewRotation(
        steps.value,
        previewLimit.value,
        includeRemoved.value,
        seed.value,
      );
      if (requestId !== requestCounter) return;
      preview.value = result;
      previewLoading.value = false;
    } catch (error) {
      if (requestId !== requestCounter) return;
      if (version === stepsVersion) validationPending.value = false;
      previewLoading.value = false;
      toast.error(errorText(error, $t("rotation.preview_failed")));
    }
  }

  function schedulePreview(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void runPreview();
    }, PREVIEW_DEBOUNCE_MS);
  }

  watch(
    steps,
    () => {
      stepsVersion += 1;
      validationPending.value = true;
    },
    { deep: true, flush: "sync" },
  );
  watch([steps, includeRemoved, previewLimit, seed], schedulePreview, {
    deep: true,
  });
  onScopeDispose(() => {
    if (timer !== undefined) clearTimeout(timer);
    requestCounter += 1;
  });

  function applyInfo(info: RotationInfo): void {
    name.value = info.name;
    steps.value = clone(info.steps);
    roundStatus.value = info.round_status;
  }

  async function load(): Promise<void> {
    loadFailed.value = false;
    try {
      const [described, recipeList] = await Promise.all([
        api.describeRotationSteps(),
        api.getRotationRecipes(),
      ]);
      const info = rotationId.value
        ? await api.getRotation(rotationId.value)
        : null;
      describe.value = described;
      recipes.value = recipeList;
      if (info) {
        applyInfo(info);
      } else {
        name.value = "";
        roundStatus.value = null;
        steps.value = [
          newStep("source", { kind: "album", depth: 0 }, described),
        ];
      }
    } catch (error) {
      loadFailed.value = true;
      toast.error(errorText(error, $t("rotation.load_failed")));
    }
    snapshot.value = currentSnapshot();
    roundUnitKind.value = unitKind(steps.value);
  }

  function applyRecipe(id: string): void {
    const recipe = recipes.value.find((entry) => entry.id === id);
    if (!recipe) return;
    if (recipe.steps.length > MAX_STEPS) {
      toast.error($t("rotation.too_many_steps"));
      return;
    }
    steps.value = clone(recipe.steps);
  }

  /**
   * Append a step with defaults to the end of the list.
   * @param type The step type to add.
   * @param to For an expand, what each item is replaced with; the default fits the list.
   */
  function addStep(type: RotationStep["type"], to?: ExpandTarget): void {
    if (!canAddStep.value || !describe.value) return;
    if (!addableStepTypes(steps.value).includes(type)) return;
    const state = listStates(steps.value).at(-1) ?? {
      kind: "album" as const,
      depth: 0,
    };
    const step = newStep(type, state, describe.value, groupKind(steps.value));
    steps.value = [
      ...steps.value,
      step.type === "expand" && to ? { ...step, to } : step,
    ];
  }

  function updateStep(index: number, step: RotationStep): void {
    if (index < 0 || index >= steps.value.length) return;
    const next = [...steps.value];
    next[index] = step;
    steps.value = next;
  }

  function removeStep(index: number): void {
    if (index < 1 || index >= steps.value.length) return;
    steps.value = steps.value.filter((_, i) => i !== index);
  }

  function moveStep(from: number, to: number): void {
    steps.value = moveStepIn(steps.value, from, to);
  }

  function showMore(): void {
    previewLimit.value = Math.min(
      PREVIEW_LIMIT_MAX,
      previewLimit.value + PREVIEW_LIMIT_STEP,
    );
  }

  function reshuffle(): void {
    seed.value = randomSeed();
  }

  async function save(): Promise<Playlist | null> {
    if (saving.value || !canSave.value) return null;
    saving.value = true;
    const saved = currentSnapshot();
    const savedUnitKind = unitKind(steps.value);
    try {
      const playlist = rotationId.value
        ? await api.updateRotation(
            rotationId.value,
            name.value.trim(),
            steps.value,
          )
        : await api.createRotation(name.value.trim(), steps.value);
      snapshot.value = saved;
      roundUnitKind.value = savedUnitKind;
      // the playlists listing was not mounted to hear about the change, so its
      // cached copy would show the old list on the way back
      store.prevState = undefined;
      toast.success($t("rotation.saved"));
      return playlist;
    } catch (error) {
      toast.error(errorText(error, $t("rotation.save_failed")));
      return null;
    } finally {
      saving.value = false;
    }
  }

  /** Load the round status of the saved Rotation again. */
  async function refreshRoundStatus(): Promise<void> {
    if (!rotationId.value) return;
    try {
      roundStatus.value = (
        await api.getRotation(rotationId.value)
      ).round_status;
    } catch (error) {
      toast.error(errorText(error, $t("rotation.round_status_failed")));
    }
  }

  async function resetRound(): Promise<void> {
    if (!rotationId.value) return;
    try {
      await api.resetRotationRound(rotationId.value);
      roundStatus.value = (
        await api.getRotation(rotationId.value)
      ).round_status;
      toast.success($t("rotation.round_reset"));
    } catch (error) {
      toast.error(errorText(error, $t("rotation.round_reset_failed")));
    }
  }

  return {
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
  };
}
