import type {
  Playlist,
  RotationDescribe,
  RotationInfo,
  RotationPreview,
} from "@/plugins/api/interfaces";
import {
  eventbus,
  type DeleteConfirmationDialogEvent,
} from "@/plugins/eventbus";
import { i18n } from "@/plugins/i18n";
import RotationEditor from "@/views/RotationEditor.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h } from "vue";
import {
  createMemoryHistory,
  createRouter,
  RouterView,
  type Router,
} from "vue-router";

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
    getItemByUri: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock, api: apiMock }));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// menus rendered in place, so their items can be picked
vi.mock("@/components/ui/dropdown-menu", () => {
  const passthrough = { template: "<div><slot /></div>" };
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuContent: passthrough,
    DropdownMenuItem: {
      emits: ["select"],
      template:
        '<button type="button" role="menuitem" @click="$emit(\'select\')"><slot /></button>',
    },
  };
});

enableAutoUnmount(afterEach);

const DESCRIBE = {
  step_types: [],
  providers: [],
  media_types: {
    artist: { fields: [], sort_keys: ["random"] },
    album: { fields: [], sort_keys: ["random"] },
    track: { fields: [], sort_keys: ["random"] },
  },
} as unknown as RotationDescribe;

const INFO: RotationInfo = {
  id: "fuchsbande",
  name: "Die drei ???",
  steps: [
    { type: "source", media_type: "album", from: "library" },
    { type: "sort", keys: [{ field: "random" }] },
    { type: "limit", count: 10 },
  ],
  playlist: null,
  round_status: { round: 3, units_total: 12, units_played: 4, exact: true },
};

const PREVIEW: RotationPreview = {
  groups: [],
  step_counts: [],
  total_tracks: 0,
  total_exact: true,
  duration_seconds: 0,
};

// plain render objects, so the file declares no extra components
const Stub = { render: () => h("div", "elsewhere") };
const App = { render: () => h(RouterView) };

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/playlists", name: "playlists", component: Stub },
      {
        path: "/rotations/new",
        name: "rotation-new",
        component: RotationEditor,
      },
      {
        path: "/rotations/:rotationId/edit",
        name: "rotation-edit",
        component: RotationEditor,
        props: true,
      },
    ],
  });
}

async function settle() {
  await vi.advanceTimersByTimeAsync(500);
  await flushPromises();
}

async function open(path: string) {
  const router = makeRouter();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, {
    global: { plugins: [router, i18n] },
    attachTo: document.body,
  });
  await settle();
  return { router, wrapper };
}

function saveButton(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('[data-testid="rotation-save"]');
}

describe("RotationEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    apiMock.describeRotationSteps.mockResolvedValue(DESCRIBE);
    apiMock.getRotationRecipes.mockResolvedValue([]);
    apiMock.getRotation.mockResolvedValue(INFO);
    apiMock.validateRotation.mockResolvedValue([]);
    apiMock.previewRotation.mockResolvedValue(PREVIEW);
    apiMock.getItemByUri.mockResolvedValue({ name: "Die drei ???" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts a new Rotation with one source step and a disabled Save", async () => {
    const { wrapper } = await open("/rotations/new");
    expect(wrapper.findAll("[data-drag-index]")).toHaveLength(1);
    expect(saveButton(wrapper).attributes("disabled")).toBeDefined();

    await wrapper.find('[data-testid="rotation-name"]').setValue("Hörspiele");
    await settle();
    expect(saveButton(wrapper).attributes("disabled")).toBeUndefined();
  });

  it("lays out steps and preview in a column on phones and side by side on large screens", async () => {
    const { wrapper } = await open("/rotations/new");
    const body = wrapper.find('[data-testid="rotation-body"]');
    expect(body.classes()).toContain("flex-col");
    expect(body.classes()).toContain("lg:flex-row");
  });

  it("shows the round status of an existing Rotation", async () => {
    const { wrapper } = await open("/rotations/fuchsbande/edit");
    expect(apiMock.getRotation).toHaveBeenCalledWith("fuchsbande");
    expect(wrapper.text()).toContain("Round 3 · 4 of 12 albums played");
  });

  it("shows the round status in the top bar", async () => {
    const { wrapper } = await open("/rotations/fuchsbande/edit");
    expect(
      wrapper
        .find(
          '[data-testid="rotation-top-bar"] [data-testid="rotation-round-status"]',
        )
        .exists(),
    ).toBe(true);
  });

  it("counts the round in the units of the Rotation", async () => {
    apiMock.getRotation.mockResolvedValue({
      ...INFO,
      steps: [{ type: "source", media_type: "track", from: "library" }],
      round_status: { round: 1, units_total: 4, units_played: 1, exact: false },
    });
    const { wrapper } = await open("/rotations/fuchsbande/edit");
    expect(wrapper.text()).toContain("Round 1 · 1 of at least 4 tracks played");
  });

  it("shows why the round could not be counted", async () => {
    apiMock.getRotation.mockResolvedValue({
      ...INFO,
      round_status: { round: 3, error: "the library is not ready" },
    });
    const { wrapper } = await open("/rotations/fuchsbande/edit");
    expect(wrapper.text()).toContain("Round 3");
    expect(wrapper.text()).toContain("the library is not ready");
  });

  it("loads the round status again after saving an existing Rotation", async () => {
    apiMock.updateRotation.mockResolvedValue({
      item_id: "42",
      provider_mappings: [],
    } as unknown as Playlist);
    const { wrapper } = await open("/rotations/fuchsbande/edit");
    apiMock.getRotation.mockResolvedValue({
      ...INFO,
      round_status: { round: 3, units_total: 9, units_played: 0, exact: true },
    });
    await wrapper.find('[data-testid="rotation-name"]').setValue("Fuchsbande");
    await settle();
    await saveButton(wrapper).trigger("click");
    await settle();
    expect(apiMock.updateRotation).toHaveBeenCalled();
    expect(wrapper.text()).toContain("Round 3 · 0 of 9 albums played");
  });

  it("leaves without asking when nothing changed", async () => {
    const emit = vi.spyOn(eventbus, "emit");
    const { router } = await open("/rotations/fuchsbande/edit");
    await router.push("/playlists");
    expect(router.currentRoute.value.name).toBe("playlists");
    expect(emit).not.toHaveBeenCalledWith(
      "deleteConfirmationDialog",
      expect.anything(),
    );
  });

  it("asks before leaving with unsaved changes and leaves on discard", async () => {
    const emit = vi.spyOn(eventbus, "emit");
    const { router, wrapper } = await open("/rotations/fuchsbande/edit");
    await wrapper.find('[data-testid="rotation-name"]').setValue("Fuchsbande");
    // held until the dialog is answered
    void router.push("/playlists");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("rotation-edit");
    const call = emit.mock.calls.find(
      ([name]) => name === "deleteConfirmationDialog",
    ) as unknown[] | undefined;
    expect(call).toBeDefined();

    const event = call![1] as DeleteConfirmationDialogEvent;
    event.onConfirm();
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("playlists");
  });

  describe("going back with unsaved changes", () => {
    async function openFromPlaylists() {
      const router = makeRouter();
      await router.push("/playlists");
      await router.isReady();
      await router.push("/rotations/fuchsbande/edit");
      const wrapper = mount(App, {
        global: { plugins: [router, i18n] },
        attachTo: document.body,
      });
      await settle();
      return { router, wrapper };
    }

    async function goBackAndAsk(
      router: Router,
      emit: { mock: { calls: unknown[][] } },
    ) {
      router.back();
      await settle();
      const call = emit.mock.calls.find(
        ([name]) => name === "deleteConfirmationDialog",
      );
      expect(call).toBeDefined();
      return call![1] as DeleteConfirmationDialogEvent;
    }

    it("returns to the previous page on discard without a second history entry", async () => {
      const emit = vi.spyOn(eventbus, "emit");
      const { router, wrapper } = await openFromPlaylists();
      await wrapper
        .find('[data-testid="rotation-name"]')
        .setValue("Fuchsbande");

      const event = await goBackAndAsk(router, emit);
      event.onConfirm();
      await settle();

      expect(router.currentRoute.value.name).toBe("playlists");
      // the editor is still the entry ahead, not one behind a second Playlists
      router.forward();
      await settle();
      expect(router.currentRoute.value.name).toBe("rotation-edit");
    });

    it("stays in the editor when the dialog is cancelled", async () => {
      const emit = vi.spyOn(eventbus, "emit");
      const { router, wrapper } = await openFromPlaylists();
      await wrapper
        .find('[data-testid="rotation-name"]')
        .setValue("Fuchsbande");

      const event = await goBackAndAsk(router, emit);
      event.onCancel?.();
      await settle();

      expect(router.currentRoute.value.name).toBe("rotation-edit");
      expect(router.options.history.location).toBe(
        "/rotations/fuchsbande/edit",
      );

      // the answer is not left pending, so the next attempt asks again
      emit.mockClear();
      const again = await goBackAndAsk(router, emit);
      again.onConfirm();
      await settle();
      expect(router.currentRoute.value.name).toBe("playlists");
    });
  });

  it("asks before opening another Rotation with unsaved changes", async () => {
    const emit = vi.spyOn(eventbus, "emit");
    const { router, wrapper } = await open("/rotations/fuchsbande/edit");
    await wrapper.find('[data-testid="rotation-name"]').setValue("Fuchsbande");
    // held until the dialog is answered
    void router.push("/rotations/hoerspiele/edit");
    await flushPromises();
    expect(router.currentRoute.value.params.rotationId).toBe("fuchsbande");
    expect(emit).toHaveBeenCalledWith(
      "deleteConfirmationDialog",
      expect.anything(),
    );
  });

  it("opens the other Rotation on discard and keeps guarding it", async () => {
    const emit = vi.spyOn(eventbus, "emit");
    const { router, wrapper } = await open("/rotations/fuchsbande/edit");
    await wrapper.find('[data-testid="rotation-name"]').setValue("Fuchsbande");
    void router.push("/rotations/hoerspiele/edit");
    await flushPromises();
    const call = emit.mock.calls.find(
      ([name]) => name === "deleteConfirmationDialog",
    ) as unknown[] | undefined;
    (call![1] as DeleteConfirmationDialogEvent).onConfirm();
    await settle();
    expect(router.currentRoute.value.params.rotationId).toBe("hoerspiele");

    emit.mockClear();
    await wrapper.find('[data-testid="rotation-name"]').setValue("Hörspiele");
    void router.push("/playlists");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("rotation-edit");
    expect(emit).toHaveBeenCalledWith(
      "deleteConfirmationDialog",
      expect.anything(),
    );
  });

  it("opens the saved Rotation for editing after creating it and keeps guarding it", async () => {
    apiMock.createRotation.mockResolvedValue({
      item_id: "42",
      provider_mappings: [
        { item_id: "fuchsbande", provider_domain: "rotation_playlist" },
      ],
    } as unknown as Playlist);
    const emit = vi.spyOn(eventbus, "emit");
    const { router, wrapper } = await open("/rotations/new");
    await wrapper.find('[data-testid="rotation-name"]').setValue("Hörspiele");
    await settle();
    await saveButton(wrapper).trigger("click");
    await flushPromises();

    expect(apiMock.createRotation).toHaveBeenCalled();
    expect(router.currentRoute.value.name).toBe("rotation-edit");
    expect(router.currentRoute.value.params.rotationId).toBe("fuchsbande");
    expect(emit).not.toHaveBeenCalledWith(
      "deleteConfirmationDialog",
      expect.anything(),
    );

    await wrapper.find('[data-testid="rotation-name"]').setValue("Fuchsbande");
    // held until the dialog is answered
    void router.push("/playlists");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("rotation-edit");
    expect(emit).toHaveBeenCalledWith(
      "deleteConfirmationDialog",
      expect.anything(),
    );
  });

  it("moves a step with the keyboard and checks the reordered steps", async () => {
    const { wrapper } = await open("/rotations/fuchsbande/edit");
    apiMock.validateRotation.mockClear();
    await wrapper
      .find('[data-drag-index="1"] [data-drag-handle]')
      .trigger("keydown", { key: "ArrowDown" });
    await settle();
    expect(apiMock.validateRotation).toHaveBeenLastCalledWith([
      INFO.steps[0],
      INFO.steps[2],
      INFO.steps[1],
    ]);
  });

  it("marks the chip that a moved step made invalid", async () => {
    const { wrapper } = await open("/rotations/fuchsbande/edit");
    expect(wrapper.find('[aria-invalid="true"]').exists()).toBe(false);
    const message = "'random' has no order here";
    apiMock.validateRotation.mockResolvedValue([
      { step: 3, field: "keys[0].field", message },
    ]);
    await wrapper
      .find('[data-drag-index="1"] [data-drag-handle]')
      .trigger("keydown", { key: "ArrowDown" });
    await settle();
    const row = wrapper.find('[data-drag-index="2"]');
    const chip = row.find('[aria-invalid="true"]');
    expect(chip.attributes("title")).toBe(message);
    expect(chip.classes()).toContain("border-destructive");
    expect(row.text()).toContain(message);
    expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(1);
  });

  it("asks to fix the marked steps in the preview when the steps have errors", async () => {
    apiMock.validateRotation.mockResolvedValue([
      { step: 3, field: "count", message: "the count must be above 0" },
    ]);
    const { wrapper } = await open("/rotations/fuchsbande/edit");
    expect(wrapper.text()).toContain("Fix the marked steps to see a preview");
  });

  it("shows an error state instead of the editor when loading fails", async () => {
    apiMock.getRotation.mockRejectedValue(new Error("gone"));
    const { wrapper } = await open("/rotations/fuchsbande/edit");
    expect(wrapper.find('[data-testid="rotation-body"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("This Rotation could not be opened");
  });

  it("explains a failed start of a new Rotation without talking of a deleted one", async () => {
    apiMock.describeRotationSteps.mockRejectedValue(new Error("offline"));
    const { wrapper } = await open("/rotations/new");
    expect(wrapper.find('[data-testid="rotation-body"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("The Rotation editor could not be opened");
    expect(wrapper.text()).not.toContain("deleted");
  });

  describe("recipes", () => {
    const RECIPE = {
      id: "albums-in-order",
      name: "Albums in order",
      goal: "Every album once, each in track order",
      steps: [
        { type: "source", media_type: "album", from: "library" },
        { type: "flatten" },
      ],
    };

    beforeEach(() => {
      apiMock.getRotationRecipes.mockResolvedValue([RECIPE]);
    });

    function pickRecipe(wrapper: ReturnType<typeof mount>) {
      return wrapper.find('[data-testid="rotation-recipe"]').trigger("click");
    }

    it("asks before a recipe replaces unsaved steps", async () => {
      const emit = vi.spyOn(eventbus, "emit");
      const { wrapper } = await open("/rotations/fuchsbande/edit");
      await wrapper
        .find('[data-testid="rotation-name"]')
        .setValue("Fuchsbande");
      await pickRecipe(wrapper);
      expect(wrapper.findAll("[data-drag-index]")).toHaveLength(3);
      const call = emit.mock.calls.find(
        ([name]) => name === "deleteConfirmationDialog",
      ) as unknown[] | undefined;
      expect(call).toBeDefined();

      (call![1] as DeleteConfirmationDialogEvent).onConfirm();
      await flushPromises();
      expect(wrapper.findAll("[data-drag-index]")).toHaveLength(2);
    });

    it("applies a recipe at once when nothing changed", async () => {
      const emit = vi.spyOn(eventbus, "emit");
      const { wrapper } = await open("/rotations/fuchsbande/edit");
      await pickRecipe(wrapper);
      await flushPromises();
      expect(wrapper.findAll("[data-drag-index]")).toHaveLength(2);
      expect(emit).not.toHaveBeenCalledWith(
        "deleteConfirmationDialog",
        expect.anything(),
      );
    });
  });

  describe("after creating a Rotation", () => {
    async function createFuchsbande() {
      apiMock.createRotation.mockResolvedValue({
        item_id: "42",
        provider_mappings: [
          { item_id: "fuchsbande", provider_domain: "rotation_playlist" },
        ],
      } as unknown as Playlist);
      const opened = await open("/rotations/new");
      await opened.wrapper
        .find('[data-testid="rotation-name"]')
        .setValue("Die drei ???");
      await settle();
      await opened.wrapper
        .find('[data-testid="rotation-save"]')
        .trigger("click");
      await settle();
      return opened;
    }

    it("shows the round status of the new Rotation", async () => {
      const { wrapper } = await createFuchsbande();
      expect(wrapper.text()).toContain("Round 3 · 4 of 12 albums played");
    });

    it("loads the new Rotation again when coming back to it", async () => {
      apiMock.getRotation.mockImplementation(async (id: string) =>
        id === "hoerspiele" ? { ...INFO, id, name: "Hörspiele" } : INFO,
      );
      const { router, wrapper } = await createFuchsbande();
      await router.push("/rotations/hoerspiele/edit");
      await settle();
      await router.push("/rotations/fuchsbande/edit");
      await settle();
      const input = wrapper.find('[data-testid="rotation-name"]')
        .element as HTMLInputElement;
      expect(input.value).toBe("Die drei ???");
    });
  });
});
