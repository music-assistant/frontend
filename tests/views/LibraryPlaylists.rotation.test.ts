import RotationIcon from "@/components/rotation/RotationIcon.vue";
import { ROTATION_PROVIDER_DOMAIN } from "@/components/rotation/constants";
import type { ToolBarMenuItem } from "@/components/Toolbar.vue";
import type { Scope } from "@/plugins/api/interfaces";
import LibraryPlaylists from "@/views/LibraryPlaylists.vue";
import { flushPromises, shallowMount } from "@vue/test-utils";
import { toRaw } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, authMock, storeMock, routerMock } = vi.hoisted(() => ({
  apiMock: {
    providers: {},
    getLibraryPlaylists: vi.fn().mockResolvedValue([]),
    getLibraryPlaylistsCount: vi.fn().mockResolvedValue(0),
    subscribe: vi.fn(() => () => {}),
    subscribe_multi: vi.fn(() => () => {}),
  },
  authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
  storeMock: {
    enabledPlugins: new Set<string>(),
    libraryPlaylistsCount: 0,
  },
  routerMock: { push: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock, api: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: authMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: { emit: vi.fn() } }));
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => routerMock,
}));
vi.mock("@/composables/useLibrarySync", () => ({
  onLibrarySyncCompleted: () => () => {},
}));
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["extraMenuItems"],
    template: "<div />",
  },
}));

async function createMenu(): Promise<ToolBarMenuItem[] | undefined> {
  const view = shallowMount(LibraryPlaylists, {
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  const items = view
    .findComponent({ name: "ItemsListing" })
    .props("extraMenuItems") as ToolBarMenuItem[];
  return items.find((item) => item.label === "create_playlist_on")?.subItems;
}

describe("LibraryPlaylists Rotation entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.enabledPlugins = new Set([ROTATION_PROVIDER_DOMAIN]);
    authMock.hasScope.mockReturnValue(true);
  });

  it("offers a new Rotation that opens the editor", async () => {
    const entry = (await createMenu())?.find(
      (item) => item.label === "rotation.create",
    );

    expect(toRaw(entry?.icon)).toBe(RotationIcon);
    entry?.action?.();
    expect(routerMock.push).toHaveBeenCalledWith({ name: "rotation-new" });
  });

  it("hides the entry while the Rotation plugin is not enabled", async () => {
    storeMock.enabledPlugins = new Set();

    expect(await createMenu()).toBeUndefined();
  });

  it("hides the entry from a user who cannot edit the library", async () => {
    authMock.hasScope.mockReturnValue(false);

    expect(await createMenu()).toBeUndefined();
  });
});
