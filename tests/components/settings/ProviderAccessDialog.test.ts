import ProviderAccessDialog from "@/components/settings/providers/ProviderAccessDialog.vue";
import { ProviderSharing, UserRole } from "@/plugins/api/interfaces";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../../fixtures/providerConfig";
import { user } from "../../fixtures/user";

const { apiMock, storeMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    providerManifests: {} as Record<string, { name: string }>,
    providers: {} as Record<string, { name: string }>,
    setProviderAccess: vi.fn(),
  },
  storeMock: {
    isTouchscreen: false,
  },
  toastMock: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

const owner = user({
  user_id: "owner-id",
  username: "owner",
  display_name: "Owner",
});
const member = user({
  user_id: "member-id",
  username: "member",
  display_name: "Member",
});
const guest = user({
  user_id: "guest-id",
  username: "guest",
  role: UserRole.GUEST,
});
const users = [owner, member, guest];

const ownedSource = providerConfig({
  domain: "spotify",
  instance_id: "spotify--owned",
  access: {
    owner: "owner-id",
    sharing: ProviderSharing.SELECTED,
    shared_users: ["member-id"],
  },
});

// an open dialog keeps document-level focus trap listeners, so tear it down
// even when an assertion fails
enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  storeMock.isTouchscreen = false;
  apiMock.providerManifests = { spotify: { name: "Spotify" } };
  apiMock.providers = {};
  apiMock.setProviderAccess.mockImplementation(
    async (_instanceId: string, access: unknown) =>
      providerConfig({ access: access as never }),
  );
  document.body.innerHTML = "";
});

describe("ProviderAccessDialog", () => {
  it("names the source in the title", async () => {
    await openDialog(ownedSource, users);

    expect(
      document.querySelector("[data-slot='dialog-title']")?.textContent,
    ).toContain("settings.source_access.title");
  });

  it("names a source that is not loaded by its config", async () => {
    await openDialog(
      providerConfig({
        domain: "spotify",
        name: null,
        default_name: "Spotify (sam)",
      }),
      users,
    );

    expect(
      document.querySelector("[data-slot='dialog-title']")?.textContent,
    ).toContain("settings.source_access.title");
    expect(dialogText()).toContain("Spotify (sam)");
  });

  it("starts from the current record", async () => {
    await openDialog(ownedSource, users);

    expect(ownerTrigger()?.textContent).toContain("Owner");
    expect(sharingTrigger()?.textContent).toContain(
      "settings.source_access.options.selected",
    );
    expect(sharedUsersField()).not.toBeNull();
    expect(dialogText()).toContain("Member");
  });

  it("reads a source without a record as a household source for everyone", async () => {
    await openDialog(providerConfig({ domain: "spotify" }), users);

    expect(ownerTrigger()?.textContent).toContain(
      "settings.source_access.household",
    );
    expect(sharingTrigger()?.textContent).toContain(
      "settings.source_access.options.everyone",
    );
    expect(sharedUsersField()).toBeNull();
  });

  it("offers only enabled non-guest users as owner", async () => {
    await openDialog(ownedSource, [
      ...users,
      user({ user_id: "off", username: "off", enabled: false }),
    ]);

    await openSelect(ownerTrigger()!);

    expect(optionLabels()).toEqual([
      "settings.source_access.household",
      "Owner",
      "Member",
    ]);
  });

  it("saves the picked owner, sharing and members", async () => {
    const wrapper = await openDialog(ownedSource, users);

    await openSelect(sharingTrigger()!);
    await pickOption("settings.source_access.options.members");
    await submit(wrapper);

    expect(apiMock.setProviderAccess).toHaveBeenCalledWith("spotify--owned", {
      owner: "owner-id",
      sharing: ProviderSharing.MEMBERS,
      shared_users: [],
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.source_access.updated",
    );
    expect(wrapper.emitted("saved")).toHaveLength(1);
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("drops the new owner from the shared members", async () => {
    const wrapper = await openDialog(ownedSource, users);

    await openSelect(ownerTrigger()!);
    await pickOption("Member");
    await submit(wrapper);

    expect(apiMock.setProviderAccess).toHaveBeenCalledWith("spotify--owned", {
      owner: "member-id",
      sharing: ProviderSharing.SELECTED,
      shared_users: [],
    });
  });

  it("saves a household source without an owner", async () => {
    const wrapper = await openDialog(ownedSource, users);

    await openSelect(ownerTrigger()!);
    await pickOption("settings.source_access.household");
    await submit(wrapper);

    expect(apiMock.setProviderAccess).toHaveBeenCalledWith(
      "spotify--owned",
      expect.objectContaining({ owner: null }),
    );
  });

  it("reports a refused change and stays open", async () => {
    apiMock.setProviderAccess.mockRejectedValue(new Error("refused"));
    const wrapper = await openDialog(ownedSource, users);

    await submit(wrapper);

    expect(toastMock.error).toHaveBeenCalledWith("Error: refused");
    expect(wrapper.emitted("saved")).toBeUndefined();
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });

  describe("for an owner that can list the members", () => {
    it("picks the members but keeps the owner", async () => {
      const wrapper = await openDialog(ownedSource, users, false);

      expect(ownerTrigger()).toBeNull();
      expect(sharedUsersField()).not.toBeNull();

      await submit(wrapper);

      expect(apiMock.setProviderAccess).toHaveBeenCalledWith("spotify--owned", {
        owner: "owner-id",
        sharing: ProviderSharing.SELECTED,
        shared_users: ["member-id"],
      });
    });

    it("offers sharing with selected members", async () => {
      await openDialog(
        providerConfig({
          domain: "spotify",
          access: {
            owner: "owner-id",
            sharing: ProviderSharing.PRIVATE,
            shared_users: [],
          },
        }),
        users,
        false,
      );

      await openSelect(sharingTrigger()!);

      expect(optionLabels()).toContain(
        "settings.source_access.options.selected",
      );
    });
  });

  describe("for an owner that can not list the users", () => {
    it("hides the owner and shared members fields", async () => {
      await openDialog(ownedSource, null);

      expect(ownerTrigger()).toBeNull();
      expect(sharedUsersField()).toBeNull();
    });

    it("keeps the owner and the selected members on save", async () => {
      const wrapper = await openDialog(ownedSource, null);

      await submit(wrapper);

      expect(apiMock.setProviderAccess).toHaveBeenCalledWith("spotify--owned", {
        owner: "owner-id",
        sharing: ProviderSharing.SELECTED,
        shared_users: ["member-id"],
      });
    });

    it("does not offer sharing with selected members", async () => {
      await openDialog(
        providerConfig({
          domain: "spotify",
          access: {
            owner: "owner-id",
            sharing: ProviderSharing.PRIVATE,
            shared_users: [],
          },
        }),
        null,
      );

      await openSelect(sharingTrigger()!);

      expect(optionLabels()).toEqual([
        "settings.source_access.options.private",
        "settings.source_access.options.members",
        "settings.source_access.options.everyone",
      ]);
    });
  });
});

function ownerTrigger() {
  return document.querySelector<HTMLElement>("#provider-access-owner");
}

function sharingTrigger() {
  return document.querySelector<HTMLElement>("#provider-access-sharing");
}

function sharedUsersField() {
  return document.querySelector(
    "input[placeholder='settings.source_access.select_members']",
  );
}

function dialogText() {
  return document.querySelector("[data-slot='dialog-content']")?.textContent;
}

function optionLabels() {
  return Array.from(
    document.querySelectorAll("[data-slot='select-item']"),
    (item) => item.textContent?.trim(),
  );
}

// reka settles the listbox focus on a timer, so a plain flush is not enough
async function settle() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 30));
  await flushPromises();
}

async function openSelect(trigger: HTMLElement) {
  trigger.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerType: "mouse",
    }),
  );
  trigger.click();
  await settle();
}

async function pickOption(label: string) {
  const option = Array.from(
    document.querySelectorAll<HTMLElement>("[data-slot='select-item']"),
  ).find((item) => item.textContent?.includes(label));
  if (!option) throw new Error(`no option "${label}": ${optionLabels()}`);
  option.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  await settle();
}

async function submit(wrapper: VueWrapper) {
  document
    .querySelector<HTMLFormElement>("#form-provider-access")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await flushPromises();
  return wrapper;
}

async function openDialog(
  config: ReturnType<typeof providerConfig>,
  dialogUsers: ReturnType<typeof user>[] | null,
  canChangeOwner: boolean = dialogUsers !== null,
): Promise<VueWrapper> {
  const wrapper = mount(ProviderAccessDialog, {
    props: { open: false, config, users: dialogUsers, canChangeOwner },
    attachTo: document.body,
    global: {
      mocks: {
        // the key, plus the source name the title interpolates
        $t: (key: string, params?: { name?: string }) =>
          params?.name ? `${key} ${params.name}` : key,
      },
    },
  });
  // the form is filled when the dialog opens, not when it mounts
  await wrapper.setProps({ open: true });
  await flushPromises();
  return wrapper;
}
