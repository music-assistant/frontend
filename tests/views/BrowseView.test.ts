import ToolbarHeading from "@/components/ToolbarHeading.vue";
import BrowseView from "@/views/BrowseView.vue";
import {
  useItemsListing,
  type LoadPagedDataFn,
} from "@/composables/useItemsListing";
import { flushPromises, mount } from "@vue/test-utils";
import {
  ListingType,
  MediaType,
  SortDirection,
  SortField,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, onMounted, type PropType } from "vue";
import { track } from "../fixtures/track";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const browsed = vi.hoisted(() => ({
  items: [] as object[],
  byPath: {} as Record<string, object[]>,
}));
const browse = vi.hoisted(() =>
  vi.fn(async (path: string) => browsed.byPath[path] ?? browsed.items),
);
vi.mock("@/plugins/api", () => ({
  default: {
    getProviderName: (domain: string) => `${domain} provider`,
    browse,
  },
  api: { subscribe_multi: () => () => {} },
}));
vi.mock("@/plugins/store", () => ({ store: { activePlayerId: "player" } }));

// the listing stands in as a host for the slots it normally renders around
// its items
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["showSelectButton", "loadPagedData", "sortListing"],
    template: '<div><slot name="title" /><slot name="header" /></div>',
  },
}));
vi.mock("@/components/ui/button", () => ({
  Button: { name: "Button", template: "<button><slot /></button>" },
}));
vi.mock("@/components/details/DetailHeroPlayButton.vue", () => ({
  default: { name: "DetailHeroPlayButton", props: ["item"], template: "<i />" },
}));

describe("BrowseView", () => {
  it("shows no trail at the browse root", () => {
    const heading = mountBrowse().getComponent(ToolbarHeading);

    expect(heading.props("items")).toEqual([]);
    expect(heading.props("to")).toBeUndefined();
  });

  it("links the heading back to the browse root once inside a folder", () => {
    const heading =
      mountBrowse("filesystem://Music").getComponent(ToolbarHeading);

    expect(heading.props("to")).toEqual({ name: "browse" });
  });

  it("gives the provider its own crumb above the folders", () => {
    const heading = mountBrowse("filesystem://Music/Live").getComponent(
      ToolbarHeading,
    );

    expect(heading.props("items")).toEqual([
      {
        title: "filesystem provider",
        disabled: false,
        to: { name: "browse", query: { path: "filesystem://" } },
      },
      {
        title: "Music",
        disabled: false,
        to: { name: "browse", query: { path: "filesystem://Music" } },
      },
      {
        title: "Live",
        disabled: true,
        to: { name: "browse", query: { path: "filesystem://Music/Live" } },
      },
    ]);
  });

  it("marks the provider as the current page at its own root", () => {
    const heading = mountBrowse("filesystem://").getComponent(ToolbarHeading);

    expect(heading.props("items")).toEqual([
      {
        title: "filesystem provider",
        disabled: true,
        to: { name: "browse", query: { path: "filesystem://" } },
      },
    ]);
  });

  it("treats the 'root' path as the browse root", () => {
    const heading = mountBrowse("root").getComponent(ToolbarHeading);

    expect(heading.props("items")).toEqual([]);
    expect(heading.props("to")).toBeUndefined();
  });

  it("builds a trail for a path that names no provider", () => {
    const heading = mountBrowse("foo/bar").getComponent(ToolbarHeading);

    expect(heading.props("items")).toEqual([
      {
        title: "foo",
        disabled: false,
        to: { name: "browse", query: { path: "foo" } },
      },
      {
        title: "bar",
        disabled: true,
        to: { name: "browse", query: { path: "foo/bar" } },
      },
    ]);
  });

  it("skips empty steps so a trailing slash adds no blank crumb", () => {
    const heading = mountBrowse("filesystem://Music/").getComponent(
      ToolbarHeading,
    );

    expect(heading.props("items")).toEqual([
      {
        title: "filesystem provider",
        disabled: false,
        to: { name: "browse", query: { path: "filesystem://" } },
      },
      {
        title: "Music",
        disabled: true,
        to: { name: "browse", query: { path: "filesystem://Music" } },
      },
    ]);
  });

  it("offers the select button only below the browse root", () => {
    expect(selectButtonShown(mountBrowse())).toBe(false);
    expect(selectButtonShown(mountBrowse("root"))).toBe(false);
    expect(selectButtonShown(mountBrowse("filesystem://Music"))).toBe(true);
  });

  it("withdraws the select button where there are only folders to open", async () => {
    const wrapper = mountBrowse("filesystem://Music");
    browsed.items = [{ media_type: MediaType.FOLDER }];

    await loadListing(wrapper);
    await nextTick();

    expect(selectButtonShown(wrapper)).toBe(false);
  });

  it("starts a new listing when changing folders during a pending page request", async () => {
    const parentPath = "fs://PagingRace";
    const childPath = `${parentPath}/Child`;
    let resolveOldPage!: (items: object[]) => void;
    const oldPage = new Promise<object[]>((resolve) => {
      resolveOldPage = resolve;
    });
    let parentRequests = 0;
    const childItems = [
      {
        media_type: MediaType.FOLDER,
        name: "Nested",
        path: `${childPath}/Nested`,
        is_playable: false,
      },
    ];
    const PagingListing = defineComponent({
      name: "ItemsListing",
      props: {
        loadPagedData: {
          type: Function as PropType<LoadPagedDataFn>,
          required: true,
        },
        showSelectButton: Boolean,
      },
      setup(props) {
        const listing = useItemsListing(
          { limit: 2, loadPagedData: props.loadPagedData },
          () => undefined,
        );
        onMounted(() => listing.loadData(true));
        return {
          pagedItems: listing.pagedItems,
          loadNextPage: listing.loadNextPage,
        };
      },
      template: "<div />",
    });

    await browse.withImplementation(
      async (path) => {
        if (path === parentPath) {
          parentRequests += 1;
          return parentRequests === 1
            ? [
                {
                  media_type: MediaType.FOLDER,
                  name: "Child",
                  path: childPath,
                  is_playable: false,
                },
                track({ item_id: "parent-track" }),
              ]
            : oldPage;
        }
        return path === childPath ? childItems : [];
      },
      async () => {
        const wrapper = mount(BrowseView, {
          props: { path: parentPath },
          global: {
            stubs: {
              ItemsListing: PagingListing,
              RouterLink: true,
              VBreadcrumbs: true,
            },
          },
        });
        await flushPromises();
        const previous = wrapper.findComponent(PagingListing);
        const pendingPage = previous.vm.loadNextPage({ done: vi.fn() });
        await nextTick();

        await wrapper.setProps({ path: childPath });
        await flushPromises();
        const current = wrapper.findComponent(PagingListing);
        expect(current.vm === previous.vm).toBe(false);
        expect(browse).toHaveBeenCalledWith(
          childPath,
          "player",
          undefined,
          "",
          2,
          0,
          expect.anything(),
          expect.anything(),
        );
        expect(current.vm.pagedItems).toEqual(childItems);
        expect(current.props("showSelectButton")).toBe(false);

        resolveOldPage([track({ item_id: "late-parent-track" })]);
        await pendingPage;
        await flushPromises();
        expect(current.vm.pagedItems).toEqual(childItems);
        expect(current.props("showSelectButton")).toBe(false);
        wrapper.unmount();
      },
    );
  });

  it("loads each folder page with server search and sort parameters", async () => {
    const wrapper = mountBrowse("filesystem://Music");
    const listing = wrapper.findComponent({ name: "ItemsListing" });

    await listing.props("loadPagedData")({
      offset: 20,
      limit: 20,
      sortBy: "name:desc",
      sortField: SortField.NAME,
      sortDirection: SortDirection.DESC,
      search: "live",
    });

    expect(listing.props("sortListing")).toBe(ListingType.BROWSE);
    expect(browse).toHaveBeenCalledWith(
      "filesystem://Music",
      "player",
      undefined,
      "live",
      20,
      20,
      SortField.NAME,
      SortDirection.DESC,
    );
  });
});

describe("BrowseView folder header", () => {
  const folder = (path: string, isPlayable: boolean) => ({
    media_type: MediaType.FOLDER,
    name: path.split("/").pop(),
    path,
    is_playable: isPlayable,
  });

  beforeEach(() => {
    browsed.items = [];
    browsed.byPath = {};
    browse.mockClear();
  });

  it("offers to play a folder opened from its parent listing", async () => {
    browsed.byPath["fs://Opened"] = [folder("fs://Opened/Album", true)];
    await loadListing(mountBrowse("fs://Opened"));
    browse.mockClear();

    const wrapper = mountBrowse("fs://Opened/Album");
    await flushPromises();

    expect(playedFolder(wrapper)).toEqual(folder("fs://Opened/Album", true));
    expect(browse).not.toHaveBeenCalled();
  });

  it("looks the folder up in its parent listing when opened directly", async () => {
    browsed.byPath["fs://Linked"] = [folder("fs://Linked/Album", true)];

    const wrapper = mountBrowse("fs://Linked/Album");
    await flushPromises();

    expect(playedFolder(wrapper)).toEqual(folder("fs://Linked/Album", true));
  });

  it("looks a provider's own level up at the browse root", async () => {
    browsed.byPath["root"] = [folder("radio://", false)];

    const wrapper = mountBrowse("radio://");
    await flushPromises();

    expect(browse).toHaveBeenCalledWith(
      "root",
      "player",
      { suppressGlobalError: true },
      undefined,
      0,
    );
    expect(playedFolder(wrapper)).toBeUndefined();
  });

  it("leaves out the header for a folder that can not be played", async () => {
    browsed.byPath["spotify://"] = [folder("spotify://categories", false)];

    const wrapper = mountBrowse("spotify://categories");
    await flushPromises();

    expect(playedFolder(wrapper)).toBeUndefined();
  });

  it("does not take the '..' entry for the parent folder itself", async () => {
    browsed.byPath["fs://Up"] = [folder("fs://Up/Down", true)];
    browsed.byPath["fs://Up/Down"] = [
      { ...folder("fs://Up", false), name: ".." },
    ];
    await loadListing(mountBrowse("fs://Up/Down"));
    browsed.byPath["fs://"] = [folder("fs://Up", true)];

    const wrapper = mountBrowse("fs://Up");
    await flushPromises();

    expect(playedFolder(wrapper)).toEqual(folder("fs://Up", true));
  });

  it("ignores a lookup that finishes after moving on to another folder", async () => {
    browsed.byPath["fs://Known"] = [folder("fs://Known/Next", true)];
    await loadListing(mountBrowse("fs://Known"));
    browsed.byPath["fs://Slow"] = [folder("fs://Slow/Album", true)];
    const wrapper = mountBrowse("fs://Slow/Album");

    await wrapper.setProps({ path: "fs://Known/Next" });
    await flushPromises();

    expect(playedFolder(wrapper)).toEqual(folder("fs://Known/Next", true));
  });
});

async function loadListing(wrapper: ReturnType<typeof mountBrowse>) {
  await wrapper.findComponent({ name: "ItemsListing" }).props("loadPagedData")({
    offset: 0,
    limit: 50,
    sortBy: "original",
    sortField: SortField.ORIGINAL,
    search: "",
  });
}

function playedFolder(wrapper: ReturnType<typeof mountBrowse>) {
  const playButton = wrapper.findComponent({ name: "DetailHeroPlayButton" });
  return playButton.exists() ? playButton.props("item") : undefined;
}

function selectButtonShown(wrapper: ReturnType<typeof mountBrowse>) {
  return wrapper
    .findComponent({ name: "ItemsListing" })
    .props("showSelectButton");
}

function mountBrowse(path?: string) {
  return mount(BrowseView, {
    props: { path },
    global: { stubs: { RouterLink: true, VBreadcrumbs: true } },
  });
}
