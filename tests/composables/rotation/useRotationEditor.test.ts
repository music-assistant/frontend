import { useRotationEditor } from "@/composables/rotation/useRotationEditor";
import type {
  RotationDescribe,
  RotationInfo,
  RotationPreview,
  RotationStep,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { toast } from "vue-sonner";
import { store } from "@/plugins/store";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    describeRotationSteps: vi.fn(),
    getRotationRecipes: vi.fn(),
    getRotation: vi.fn(),
    validateRotation: vi.fn(),
    previewRotation: vi.fn(),
    createRotation: vi.fn(),
    updateRotation: vi.fn(),
    resetRotationRound: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock, api: apiMock }));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const DESCRIBE = {
  step_types: [],
  media_types: {},
  providers: [],
} as unknown as RotationDescribe;
const ARTIST_STEPS: RotationStep[] = [
  { type: "source", media_type: "album", from: "library" },
  { type: "filter", mode: "keep", match: "all", conditions: [] },
];
const INFO = {
  id: "r1",
  name: "Die drei ???",
  steps: ARTIST_STEPS,
  playlist: null,
  round_status: { round: 2 },
} as RotationInfo;

function previewOf(total: number): RotationPreview {
  return {
    groups: [],
    step_counts: [],
    total_tracks: total,
    total_exact: true,
    duration_seconds: 0,
  };
}

function setup(id: string | null) {
  const scope = effectScope();
  const editor = scope.run(() => useRotationEditor(ref(id)))!;
  return { editor, scope };
}

async function settle(ms = 400) {
  await nextTick();
  await vi.advanceTimersByTimeAsync(ms);
  await flushPromises();
}

describe("useRotationEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    apiMock.describeRotationSteps.mockResolvedValue(DESCRIBE);
    apiMock.getRotationRecipes.mockResolvedValue([
      { id: "rec", name: "Recipe", goal: "", steps: [{ type: "flatten" }] },
    ]);
    apiMock.getRotation.mockResolvedValue(INFO);
    apiMock.validateRotation.mockResolvedValue([]);
    apiMock.previewRotation.mockResolvedValue(previewOf(1));
  });
  afterEach(() => vi.useRealTimers());

  it("starts a new rotation with one source step", async () => {
    const { editor } = setup(null);
    await editor.load();
    expect(editor.steps.value).toHaveLength(1);
    expect(editor.steps.value[0]!.type).toBe("source");
    expect(editor.recipes.value).toHaveLength(1);
    expect(apiMock.getRotation).not.toHaveBeenCalled();
    expect(editor.dirty.value).toBe(false);
  });

  it("loads an existing rotation", async () => {
    const { editor } = setup("r1");
    await editor.load();
    expect(editor.name.value).toBe("Die drei ???");
    expect(editor.steps.value).toEqual(ARTIST_STEPS);
    expect(editor.roundStatus.value).toEqual({ round: 2 });
    expect(editor.dirty.value).toBe(false);
  });

  it("orders a new sort inside album groups by disc and track number", async () => {
    apiMock.describeRotationSteps.mockResolvedValue({
      ...DESCRIBE,
      media_types: {
        track: {
          fields: [],
          sort_keys: ["random", "disc_number", "track_number"],
        },
      },
    });
    apiMock.getRotation.mockResolvedValue({
      ...INFO,
      steps: [
        { type: "source", media_type: "album", from: "library" },
        { type: "expand", to: "track", scope: "library" },
      ],
    });
    const { editor } = setup("r1");
    await editor.load();
    editor.addStep("sort");
    expect(editor.steps.value.at(-1)).toEqual({
      type: "sort",
      keys: [{ field: "disc_number" }, { field: "track_number" }],
    });
  });

  it("debounces quick edits into one preview call", async () => {
    const { editor } = setup("r1");
    await editor.load();
    await settle();
    apiMock.previewRotation.mockClear();
    editor.addStep("sort");
    await vi.advanceTimersByTimeAsync(100);
    editor.addStep("limit");
    await vi.advanceTimersByTimeAsync(100);
    editor.addStep("limit");
    await settle();
    expect(apiMock.previewRotation).toHaveBeenCalledTimes(1);
  });

  it("drops a stale preview response", async () => {
    const { editor } = setup("r1");
    await editor.load();
    await settle();
    let resolveFirst: (value: RotationPreview) => void = () => {};
    apiMock.previewRotation
      .mockImplementationOnce(
        () => new Promise<RotationPreview>((r) => (resolveFirst = r)),
      )
      .mockResolvedValueOnce(previewOf(2));
    editor.addStep("sort");
    await settle();
    editor.addStep("limit");
    await settle();
    expect(editor.preview.value?.total_tracks).toBe(2);
    resolveFirst(previewOf(99));
    await flushPromises();
    expect(editor.preview.value?.total_tracks).toBe(2);
  });

  it("blocks the preview and saving on validation errors", async () => {
    apiMock.validateRotation.mockResolvedValue([
      { step: 2, field: "conditions", message: "Needs a condition" },
    ]);
    const { editor } = setup("r1");
    await editor.load();
    await settle();
    expect(apiMock.previewRotation).not.toHaveBeenCalled();
    expect(editor.errors.value.get(2)).toHaveLength(1);
    expect(editor.canSave.value).toBe(false);
  });

  it("tracks dirty across edit and save", async () => {
    apiMock.updateRotation.mockResolvedValue({ item_id: "1" });
    const { editor } = setup("r1");
    await editor.load();
    expect(editor.dirty.value).toBe(false);
    editor.addStep("limit");
    expect(editor.dirty.value).toBe(true);
    await settle();
    await editor.save();
    expect(editor.dirty.value).toBe(false);
    expect(toast.success).toHaveBeenCalled();
  });

  it("creates a new rotation on save", async () => {
    apiMock.createRotation.mockResolvedValue({ item_id: "2" });
    const { editor } = setup(null);
    await editor.load();
    editor.name.value = " Hörspiele ";
    await settle();
    expect(editor.canSave.value).toBe(true);
    await editor.save();
    expect(apiMock.createRotation).toHaveBeenCalledWith(
      "Hörspiele",
      editor.steps.value,
    );
  });

  it("makes the playlists listing load again after a save", async () => {
    apiMock.createRotation.mockResolvedValue({ item_id: "2" });
    store.prevState = { path: "playlists" } as typeof store.prevState;
    const { editor } = setup(null);
    await editor.load();
    editor.name.value = "Neu";
    await settle();
    await editor.save();
    expect(store.prevState).toBeUndefined();
  });

  it("keeps the cached listing when a save fails", async () => {
    apiMock.updateRotation.mockRejectedValue(new Error("broken"));
    const cached = { path: "playlists" } as typeof store.prevState;
    store.prevState = cached;
    const { editor } = setup("r1");
    await editor.load();
    editor.addStep("limit");
    await settle();
    await editor.save();
    expect(store.prevState).toEqual(cached);
    store.prevState = undefined;
  });

  it("toasts a save error and stays dirty", async () => {
    apiMock.updateRotation.mockRejectedValue(new Error("Step 2 is broken"));
    const { editor } = setup("r1");
    await editor.load();
    editor.addStep("limit");
    await settle();
    expect(await editor.save()).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Step 2 is broken");
    expect(editor.dirty.value).toBe(true);
    expect(editor.saving.value).toBe(false);
  });

  it("toasts a preview error instead of crashing", async () => {
    const { editor } = setup("r1");
    await editor.load();
    apiMock.previewRotation.mockRejectedValue(new Error("No such album"));
    editor.addStep("limit");
    await settle();
    expect(toast.error).toHaveBeenCalledWith("No such album");
    expect(editor.previewLoading.value).toBe(false);
  });

  it("caps showMore at 200", async () => {
    const { editor } = setup("r1");
    await editor.load();
    expect(editor.previewLimit.value).toBe(20);
    for (let i = 0; i < 15; i++) editor.showMore();
    expect(editor.previewLimit.value).toBe(200);
  });

  it("changes the seed on reshuffle and previews again", async () => {
    const { editor } = setup("r1");
    await editor.load();
    await settle();
    const firstSeed = apiMock.previewRotation.mock.calls[0]![3];
    apiMock.previewRotation.mockClear();
    editor.reshuffle();
    await settle();
    expect(apiMock.previewRotation).toHaveBeenCalledTimes(1);
    expect(apiMock.previewRotation.mock.calls[0]![3]).not.toBe(firstSeed);
  });

  it("keeps the seed for other edits", async () => {
    const { editor } = setup("r1");
    await editor.load();
    await settle();
    editor.addStep("limit");
    await settle();
    const seeds = apiMock.previewRotation.mock.calls.map((c) => c[3]);
    expect(new Set(seeds).size).toBe(1);
  });

  it("refuses to add beyond 30 steps", async () => {
    const { editor } = setup(null);
    await editor.load();
    while (editor.canAddStep.value) editor.addStep("limit");
    expect(editor.steps.value).toHaveLength(30);
    editor.addStep("limit");
    expect(editor.steps.value).toHaveLength(30);
    expect(editor.canAddStep.value).toBe(false);
  });

  it("ignores removing the source step and moves steps", async () => {
    const { editor } = setup("r1");
    await editor.load();
    editor.removeStep(0);
    expect(editor.steps.value).toHaveLength(2);
    editor.addStep("limit");
    editor.moveStep(1, 2);
    expect(editor.steps.value[1]!.type).toBe("limit");
    editor.removeStep(1);
    expect(editor.steps.value).toHaveLength(2);
  });

  it("applies a recipe and resets the round", async () => {
    const { editor } = setup("r1");
    await editor.load();
    editor.applyRecipe("rec");
    expect(editor.steps.value).toEqual([{ type: "flatten" }]);
    await editor.resetRound();
    expect(apiMock.resetRotationRound).toHaveBeenCalledWith("r1");
    expect(toast.success).toHaveBeenCalled();
  });

  it("keeps edits made while a save is in flight dirty", async () => {
    let resolveSave: (value: unknown) => void = () => {};
    apiMock.updateRotation.mockImplementation(
      () => new Promise((r) => (resolveSave = r)),
    );
    const { editor } = setup("r1");
    await editor.load();
    editor.addStep("limit");
    await settle();
    const pending = editor.save();
    editor.addStep("sort");
    resolveSave({ item_id: "1" });
    await pending;
    expect(editor.dirty.value).toBe(true);
  });

  it("flags a failed load without turning dirty", async () => {
    apiMock.getRotation.mockRejectedValue(new Error("Gone"));
    const { editor } = setup("r1");
    await editor.load();
    expect(editor.loadFailed.value).toBe(true);
    expect(editor.dirty.value).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Gone");
    expect(editor.describe.value).toBeNull();
    expect(editor.recipes.value).toHaveLength(0);
  });

  it("flags a failed describe on a new rotation", async () => {
    apiMock.describeRotationSteps.mockRejectedValue(new Error("Offline"));
    const { editor } = setup(null);
    await editor.load();
    expect(editor.loadFailed.value).toBe(true);
    expect(editor.dirty.value).toBe(false);
  });

  it("creates only one rotation on a double save", async () => {
    apiMock.createRotation.mockResolvedValue({ item_id: "2" });
    const { editor } = setup(null);
    await editor.load();
    editor.name.value = "Hörspiele";
    await settle();
    const first = editor.save();
    const second = editor.save();
    await Promise.all([first, second]);
    expect(await second).toBeNull();
    expect(apiMock.createRotation).toHaveBeenCalledTimes(1);
  });

  it("refuses a recipe with more than 30 steps", async () => {
    apiMock.getRotationRecipes.mockResolvedValue([
      {
        id: "big",
        name: "Big",
        goal: "",
        steps: Array.from({ length: 31 }, () => ({ type: "flatten" })),
      },
    ]);
    const { editor } = setup("r1");
    await editor.load();
    editor.applyRecipe("big");
    expect(editor.steps.value).toEqual(ARTIST_STEPS);
    expect(toast.error).toHaveBeenCalled();
  });

  it("blocks saving until the validation of an edit answered", async () => {
    apiMock.updateRotation.mockResolvedValue({ item_id: "1" });
    const { editor } = setup("r1");
    await editor.load();
    await settle();
    expect(editor.canSave.value).toBe(true);
    let resolveValidate: (value: unknown[]) => void = () => {};
    apiMock.validateRotation.mockImplementationOnce(
      () => new Promise((r) => (resolveValidate = r)),
    );
    editor.addStep("limit");
    await nextTick();
    expect(editor.canSave.value).toBe(false);
    await vi.advanceTimersByTimeAsync(400);
    expect(editor.canSave.value).toBe(false);
    resolveValidate([]);
    await flushPromises();
    expect(editor.canSave.value).toBe(true);
  });

  it("does nothing after the scope is disposed", async () => {
    const { editor, scope } = setup("r1");
    await editor.load();
    await settle();
    apiMock.validateRotation.mockClear();
    editor.addStep("limit");
    await nextTick();
    scope.stop();
    await settle();
    expect(apiMock.validateRotation).not.toHaveBeenCalled();
  });
  it("adds an expand to the tracks of each artist when asked", async () => {
    apiMock.getRotation.mockResolvedValue({
      ...INFO,
      steps: [{ type: "source", media_type: "artist", from: "library" }],
    });
    const { editor } = setup("r1");
    await editor.load();
    editor.addStep("expand", "track");
    expect(editor.steps.value[1]).toMatchObject({
      type: "expand",
      to: "track",
    });
    editor.addStep("filter");
    expect(editor.steps.value).toHaveLength(3);
  });
});
