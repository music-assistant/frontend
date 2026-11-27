import AddGroupDialog from "@/components/AddGroupDialog.vue";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  type Player,
  PlayerFeature,
  ProviderFeature,
  type ProviderInstance,
  type ProviderManifest,
  ProviderType,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { player } from "../fixtures/player";
import { providerInstance } from "../fixtures/providerInstance";
import { providerManifest } from "../fixtures/providerManifest";

const { apiMock, storeMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    createPlayerGroup: vi.fn(),
    players: {} as Record<string, Player>,
    providers: {} as Record<string, ProviderInstance>,
    providerManifests: {} as Record<string, ProviderManifest>,
  },
  storeMock: { dialogActive: false },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/plugins/api", async () => ({
  api: apiMock,
  default: apiMock,
  ApiCommandError: (await import("@/plugins/api/errors")).ApiCommandError,
}));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));
// the arguments show in the text, so a test can read the names back
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args ? `${key}(${args.join(",")})` : key,
}));

const passthroughStub = { template: "<div><slot /></div>" };
// the real dialog only mounts its content while it is open, so the stub does too
const DialogStub = {
  name: "Dialog",
  props: ["open"],
  emits: ["update:open"],
  template: `<div v-if="open" class="add-group-dialog"><slot /></div>`,
};
const ButtonStub = {
  props: ["disabled", "loading"],
  template: `<button :disabled="disabled || loading" :data-loading="loading"><slot /></button>`,
};
const InputStub = {
  props: ["modelValue", "disabled"],
  emits: ["update:modelValue"],
  template: `
    <input
      :value="modelValue"
      :disabled="disabled"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  `,
};
const SwitchStub = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: `<button type="button" :data-checked="modelValue" @click="$emit('update:modelValue', !modelValue)" />`,
};
const RadioGroupStub = {
  name: "RadioGroup",
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: `<div class="kind-choice"><slot /></div>`,
};
const CheckboxStub = {
  props: ["modelValue", "disabled"],
  emits: ["update:modelValue"],
  template: `
    <button
      type="button"
      class="member-checkbox"
      :data-checked="modelValue"
      :disabled="disabled"
      @click="$emit('update:modelValue', !modelValue)"
    />
  `,
};

const SYNC_DESCRIPTION = "Speakers play in sync.";
const UNIVERSAL_DESCRIPTION = "Speakers play the same audio.";

function mountDialog() {
  return mount(AddGroupDialog, {
    global: {
      mocks: {
        $t: (key: string, args?: unknown[]) =>
          args ? `${key}(${args.join(",")})` : key,
      },
      stubs: {
        Button: ButtonStub,
        Checkbox: CheckboxStub,
        Dialog: DialogStub,
        DialogContent: passthroughStub,
        DialogDescription: {
          template: `<p class="dialog-description"><slot /></p>`,
        },
        DialogFooter: passthroughStub,
        DialogHeader: passthroughStub,
        DialogTitle: passthroughStub,
        Input: InputStub,
        PlayerIcon: true,
        PlayerStatusIcon: true,
        RadioGroup: RadioGroupStub,
        RadioGroupItem: true,
        Switch: SwitchStub,
        TriangleAlert: true,
      },
    },
  });
}

function setProviders(...domains: string[]) {
  apiMock.providers = Object.fromEntries(
    [
      // a player provider that makes no groups is no kind of group
      providerInstance({
        type: ProviderType.PLAYER,
        domain: "sonos",
        instance_id: "sonos--1",
        name: "Sonos",
      }),
      ...domains.map((domain) =>
        providerInstance({
          type: ProviderType.PLAYER,
          domain,
          instance_id: domain,
          name: "",
          supported_features: [ProviderFeature.CREATE_GROUP_PLAYER],
        }),
      ),
    ].map((provider) => [provider.instance_id, provider]),
  );
}

async function openDialog(provider?: string) {
  const onCreated = vi.fn();
  eventbus.emit("addGroupDialog", { provider, onCreated });
  await flushPromises();
  return onCreated;
}

function memberNames(wrapper: VueWrapper) {
  return wrapper
    .findAll(".member-checkbox")
    .map((checkbox) => checkbox.attributes("aria-label"));
}

async function pickMember(wrapper: VueWrapper, name: string) {
  await wrapper.get(`.member-checkbox[aria-label="${name}"]`).trigger("click");
}

async function submit(wrapper: VueWrapper) {
  await wrapper.get("#add-group-form").trigger("submit");
  await flushPromises();
}

describe("AddGroupDialog", () => {
  // the dialog is mounted once for the whole app and unsubscribes on unmount, so a
  // leaked instance would answer the next test's event as well
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.dialogActive = false;
    apiMock.providerManifests = {
      sync_group: providerManifest({
        domain: "sync_group",
        name: "Sync Group Player",
        description: SYNC_DESCRIPTION,
      }),
      universal_group: providerManifest({
        domain: "universal_group",
        name: "Universal Group Player",
        description: UNIVERSAL_DESCRIPTION,
      }),
    };
    // Office plays, but does not sync
    apiMock.players = Object.fromEntries(
      [
        player({
          player_id: "kitchen",
          name: "Kitchen",
          can_group_with: ["living_room", "bedroom"],
        }),
        player({
          player_id: "living_room",
          name: "Living room",
          can_group_with: ["kitchen", "bedroom"],
        }),
        player({
          player_id: "bedroom",
          name: "Bedroom",
          can_group_with: ["kitchen", "living_room"],
        }),
        player({
          player_id: "office",
          name: "Office",
          supported_features: [PlayerFeature.VOLUME_SET],
        }),
      ].map((item) => [item.player_id, item]),
    );
    setProviders("sync_group");
    apiMock.createPlayerGroup.mockResolvedValue(
      player({ player_id: "syncgroup_downstairs", name: "Downstairs" }),
    );
  });

  it("opens straight on the form when one kind of group can be created", async () => {
    const wrapper = mountDialog();
    expect(wrapper.find(".add-group-dialog").exists()).toBe(false);

    await openDialog();

    expect(wrapper.find(".add-group-dialog").exists()).toBe(true);
    expect(storeMock.dialogActive).toBe(true);
    expect(wrapper.find('[data-testid="add-group-kinds"]').exists()).toBe(
      false,
    );
    expect(wrapper.get(".dialog-description").text()).toBe(SYNC_DESCRIPTION);
    // the speakers that sync, by their names
    expect(memberNames(wrapper)).toEqual(["Bedroom", "Kitchen", "Living room"]);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("offers the kinds when several can be created, starting on the first", async () => {
    setProviders("universal_group", "sync_group");
    const wrapper = mountDialog();
    await openDialog();

    const kinds = wrapper.get('[data-testid="add-group-kinds"]');
    expect(kinds.findAll("label").map((label) => label.text())).toEqual([
      "Sync Group Player",
      "Universal Group Player",
    ]);
    expect(
      wrapper.getComponent({ name: "RadioGroup" }).props("modelValue"),
    ).toBe("sync_group");

    await pickMember(wrapper, "Kitchen");
    wrapper
      .getComponent({ name: "RadioGroup" })
      .vm.$emit("update:modelValue", "universal_group");
    await flushPromises();

    // the header describes the kind picked, which takes other members
    expect(wrapper.get(".dialog-description").text()).toBe(
      UNIVERSAL_DESCRIPTION,
    );
    expect(memberNames(wrapper)).toEqual([
      "Bedroom",
      "Kitchen",
      "Living room",
      "Office",
    ]);
    expect(
      wrapper
        .findAll(".member-checkbox")
        .filter((checkbox) => checkbox.attributes("data-checked") === "true"),
    ).toHaveLength(0);
  });

  it("offers no other kind when it opens for one provider", async () => {
    setProviders("sync_group", "universal_group");
    const wrapper = mountDialog();

    await openDialog("universal_group");

    expect(wrapper.find('[data-testid="add-group-kinds"]').exists()).toBe(
      false,
    );
    expect(wrapper.get(".dialog-description").text()).toBe(
      UNIVERSAL_DESCRIPTION,
    );
  });

  it("asks for a name, and for members unless speakers may join later", async () => {
    const wrapper = mountDialog();
    const onCreated = await openDialog();

    await submit(wrapper);

    expect(apiMock.createPlayerGroup).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(wrapper.find(".add-group-dialog").exists()).toBe(true);
    expect(errors(wrapper)).toEqual(["settings.add_group.name_required"]);

    // a group no speaker may join later needs one from the start
    await wrapper.get("#add-group-dynamic").trigger("click");
    await wrapper.get("#add-group-name").setValue("   ");
    await submit(wrapper);

    expect(apiMock.createPlayerGroup).not.toHaveBeenCalled();
    expect(errors(wrapper)).toEqual([
      "settings.add_group.name_required",
      "settings.add_group.members_required",
    ]);

    await wrapper.get("#add-group-name").setValue("Downstairs");
    await pickMember(wrapper, "Kitchen");

    expect(errors(wrapper)).toEqual([]);
  });

  it("creates the group, says so, and closes", async () => {
    const wrapper = mountDialog();
    const onCreated = await openDialog();

    await wrapper.get("#add-group-name").setValue("  Downstairs ");
    await pickMember(wrapper, "Kitchen");
    await pickMember(wrapper, "Living room");
    await wrapper.get("#add-group-dynamic").trigger("click");
    await submit(wrapper);

    expect(apiMock.createPlayerGroup).toHaveBeenCalledExactlyOnceWith(
      "sync_group",
      "Downstairs",
      ["kitchen", "living_room"],
      false,
    );
    expect(toastMock.success).toHaveBeenCalledExactlyOnceWith(
      "settings.add_group.created(Downstairs)",
    );
    expect(wrapper.find(".add-group-dialog").exists()).toBe(false);
    expect(storeMock.dialogActive).toBe(false);
    expect(onCreated).toHaveBeenCalledExactlyOnceWith("syncgroup_downstairs");
  });

  it("lets speakers join and leave a new group unless the user says otherwise", async () => {
    const wrapper = mountDialog();
    await openDialog();

    await wrapper.get("#add-group-name").setValue("Downstairs");
    await submit(wrapper);

    expect(apiMock.createPlayerGroup).toHaveBeenCalledExactlyOnceWith(
      "sync_group",
      "Downstairs",
      [],
      true,
    );
  });

  it("stays open and busy while the server creates the group", async () => {
    let finish: (group: Player) => void = () => {};
    apiMock.createPlayerGroup.mockReturnValue(
      new Promise<Player>((resolve) => {
        finish = resolve;
      }),
    );
    const wrapper = mountDialog();
    const onCreated = await openDialog();
    await wrapper.get("#add-group-name").setValue("Downstairs");

    await submit(wrapper);

    expect(
      wrapper.get('[data-testid="add-group-create"]').attributes(),
    ).toMatchObject({ "data-loading": "true", disabled: "" });
    expect(wrapper.get("#add-group-name").attributes()).toHaveProperty(
      "disabled",
    );
    // closing waits for the answer of the server
    wrapper.getComponent({ name: "Dialog" }).vm.$emit("update:open", false);
    await flushPromises();
    expect(wrapper.find(".add-group-dialog").exists()).toBe(true);

    finish(player({ player_id: "syncgroup_downstairs" }));
    await flushPromises();

    expect(wrapper.find(".add-group-dialog").exists()).toBe(false);
    expect(onCreated).toHaveBeenCalledOnce();
  });

  it("stays open with the reason when the server refuses the group", async () => {
    apiMock.createPlayerGroup.mockRejectedValue(
      new ApiCommandError(
        "Provider sync_group not found",
        999,
        "Provider sync_group not found",
      ),
    );
    const wrapper = mountDialog();
    const onCreated = await openDialog();
    await wrapper.get("#add-group-name").setValue("Downstairs");
    await pickMember(wrapper, "Kitchen");

    await submit(wrapper);

    expect(wrapper.find(".add-group-dialog").exists()).toBe(true);
    expect(wrapper.get('[data-testid="add-group-error"]').text()).toBe(
      "Provider sync_group not found",
    );
    // what the user entered stays, to try again
    expect(
      (wrapper.get("#add-group-name").element as HTMLInputElement).value,
    ).toBe("Downstairs");
    expect(
      wrapper
        .get('.member-checkbox[aria-label="Kitchen"]')
        .attributes("data-checked"),
    ).toBe("true");
    expect(
      wrapper.get('[data-testid="add-group-create"]').attributes(),
    ).not.toHaveProperty("disabled");
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("says the group could not be created when the server gives no reason", async () => {
    apiMock.createPlayerGroup.mockRejectedValue(new Error("Connection lost"));
    const wrapper = mountDialog();
    await openDialog();
    await wrapper.get("#add-group-name").setValue("Downstairs");

    await submit(wrapper);

    expect(wrapper.get('[data-testid="add-group-error"]').text()).toBe(
      "settings.add_group.failed",
    );
  });

  it("opens empty again after a refused group", async () => {
    apiMock.createPlayerGroup.mockRejectedValue(new Error("Connection lost"));
    const wrapper = mountDialog();
    await openDialog();
    await wrapper.get("#add-group-name").setValue("Downstairs");
    await pickMember(wrapper, "Kitchen");
    await submit(wrapper);

    wrapper.getComponent({ name: "Dialog" }).vm.$emit("update:open", false);
    await openDialog();

    expect(
      (wrapper.get("#add-group-name").element as HTMLInputElement).value,
    ).toBe("");
    expect(
      wrapper
        .get('.member-checkbox[aria-label="Kitchen"]')
        .attributes("data-checked"),
    ).toBe("false");
    expect(wrapper.find('[data-testid="add-group-error"]').exists()).toBe(
      false,
    );
    expect(errors(wrapper)).toEqual([]);
  });
});

// the errors the form shows next to its fields
function errors(wrapper: VueWrapper) {
  return wrapper
    .findAll('[data-slot="field-error"]')
    .map((error) => error.text());
}
