import PlaylistAccessDialog from "@/layouts/default/PlaylistAccessDialog.vue";
import {
  type PlaylistAccess,
  ProviderSharing,
  type Scope,
  type UserSummary,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";
import { providerMapping } from "../fixtures/providerMapping";
import { selectOptions } from "../fixtures/rekaSelect";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { apiMock, authMock, storeMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getShareCandidates: vi.fn(),
    setPlaylistAccess: vi.fn(),
  },
  authMock: {
    hasScope: vi.fn<(scope: Scope) => boolean>(),
  },
  storeMock: {
    currentUser: undefined,
    dialogActive: false,
    isTouchscreen: false,
  },
  toastMock: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: authMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

const members: UserSummary[] = [
  {
    user_id: "owner-id",
    username: "owner",
    display_name: "Owner",
    avatar_url: null,
  },
  {
    user_id: "member-id",
    username: "member",
    display_name: "Member",
    avatar_url: null,
  },
];

const maPlaylist = (access: PlaylistAccess | null) =>
  playlist({
    item_id: "42",
    name: "Road trip",
    is_editable: true,
    provider_mappings: [providerMapping({ provider_domain: "builtin" })],
    access,
  });

const sharedWithMember: PlaylistAccess = {
  owner: "owner-id",
  sharing: ProviderSharing.SELECTED,
  shared_users: ["member-id"],
  collaborative: false,
};

// an open dialog keeps document-level focus trap listeners, so tear it down
// even when an assertion fails
enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  storeMock.dialogActive = false;
  storeMock.isTouchscreen = false;
  authMock.hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  apiMock.getShareCandidates.mockResolvedValue(members);
  apiMock.setPlaylistAccess.mockResolvedValue(maPlaylist(sharedWithMember));
  document.body.innerHTML = "";
});

describe("PlaylistAccessDialog", () => {
  it("names the playlist in the title", async () => {
    await openDialog(maPlaylist(sharedWithMember));

    expect(
      document.querySelector("[data-slot='dialog-title']")?.textContent,
    ).toContain("playlist_access.title Road trip");
  });

  it("offers the owner only to a library manager that can list the members", async () => {
    await openDialog(maPlaylist(sharedWithMember));

    expect(ownerTrigger()).not.toBeNull();
  });

  it("hides the owner from a member", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );

    await openDialog(maPlaylist(sharedWithMember));

    expect(ownerTrigger()).toBeNull();
  });

  it("hides the owner while the members can not be listed", async () => {
    apiMock.getShareCandidates.mockRejectedValue(new Error("refused"));

    await openDialog(maPlaylist(sharedWithMember));

    expect(ownerTrigger()).toBeNull();
    expect(sharedUsersField()).toBeNull();
  });

  it("does not offer selected members while the members can not be listed", async () => {
    apiMock.getShareCandidates.mockRejectedValue(new Error("refused"));

    await openDialog(
      maPlaylist({ ...sharedWithMember, sharing: ProviderSharing.PRIVATE }),
    );
    await openSelect(sharingTrigger()!);

    expect(optionLabels()).not.toContain(
      "settings.source_access.options.selected",
    );
  });

  it("keeps selected members while it is the current choice", async () => {
    apiMock.getShareCandidates.mockRejectedValue(new Error("refused"));

    await openDialog(maPlaylist(sharedWithMember));
    await openSelect(sharingTrigger()!);

    expect(optionLabels()).toContain("settings.source_access.options.selected");
  });

  it("does not offer only me for a playlist without an owner", async () => {
    await openDialog(
      maPlaylist({
        owner: null,
        sharing: ProviderSharing.MEMBERS,
        shared_users: [],
        collaborative: false,
      }),
    );
    await openSelect(sharingTrigger()!);

    expect(optionLabels()).not.toContain(
      "settings.source_access.options.private",
    );
    expect(optionLabels()).not.toContain(
      "settings.source_access.options.not_shared",
    );
  });

  it("does not save a playlist without an owner shared with nobody", async () => {
    await openDialog(
      maPlaylist({
        owner: null,
        sharing: ProviderSharing.SELECTED,
        shared_users: [],
        collaborative: false,
      }),
    );

    expect(saveButton()!.disabled).toBe(true);
  });

  it("saves the owner, sharing, members and collaborative flag", async () => {
    const wrapper = await openDialog(maPlaylist(sharedWithMember));

    collaborativeSwitch()!.click();
    await submit(wrapper);

    expect(apiMock.setPlaylistAccess).toHaveBeenCalledWith("42", {
      owner: "owner-id",
      sharing: ProviderSharing.SELECTED,
      shared_users: ["member-id"],
      collaborative: true,
    });
    expect(toastMock.success).toHaveBeenCalledWith("playlist_access.updated");
  });

  it("drops the shared members when sharing with everyone", async () => {
    const wrapper = await openDialog(maPlaylist(sharedWithMember));

    await openSelect(sharingTrigger()!);
    await pickOption("settings.source_access.options.everyone");
    await submit(wrapper);

    expect(apiMock.setPlaylistAccess).toHaveBeenCalledWith("42", {
      owner: "owner-id",
      sharing: ProviderSharing.EVERYONE,
      shared_users: [],
      collaborative: false,
    });
  });

  it("reads a playlist without a record as shared with everyone", async () => {
    const wrapper = await openDialog(maPlaylist(null));

    await submit(wrapper);

    expect(apiMock.setPlaylistAccess).toHaveBeenCalledWith("42", {
      owner: null,
      sharing: ProviderSharing.EVERYONE,
      shared_users: [],
      collaborative: false,
    });
  });

  it("reports a refused change and stays open", async () => {
    apiMock.setPlaylistAccess.mockRejectedValue(new Error("refused"));
    const wrapper = await openDialog(maPlaylist(sharedWithMember));

    await submit(wrapper);

    expect(toastMock.error).toHaveBeenCalledWith("Error: refused");
    expect(dialogText()).not.toBeUndefined();
  });
});

function ownerTrigger() {
  return document.querySelector<HTMLElement>("#playlist-access-owner");
}

function sharingTrigger() {
  return document.querySelector<HTMLElement>("#playlist-access-sharing");
}

function saveButton() {
  return document.querySelector<HTMLButtonElement>(
    "button[form='form-playlist-access']",
  );
}

function collaborativeSwitch() {
  return document.querySelector<HTMLElement>("#playlist-access-collaborative");
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
  return selectOptions().map((item) => item.textContent?.trim());
}

// reka settles the listbox focus on a timer, so a plain flush is not enough
async function settle() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 30));
  await flushPromises();
}

// the dialog is portalled out of the wrapper, so its selects are driven
// through the document rather than through the wrapper
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
  const option = selectOptions().find((item) =>
    item.textContent?.includes(label),
  );
  if (!option) throw new Error(`no option "${label}": ${optionLabels()}`);
  option.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  await settle();
}

async function submit(wrapper: VueWrapper) {
  document
    .querySelector<HTMLFormElement>("#form-playlist-access")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await flushPromises();
  return wrapper;
}

async function openDialog(
  item: ReturnType<typeof playlist>,
): Promise<VueWrapper> {
  const wrapper = mount(PlaylistAccessDialog, {
    attachTo: document.body,
    global: {
      mocks: {
        // the key, plus the playlist name the title interpolates
        $t: (key: string, params?: { name?: string }) =>
          params?.name ? `${key} ${params.name}` : key,
      },
    },
  });
  // the form is filled when the dialog opens, not when it mounts
  eventbus.emit("playlistAccessDialog", { playlist: item });
  await flushPromises();
  return wrapper;
}
