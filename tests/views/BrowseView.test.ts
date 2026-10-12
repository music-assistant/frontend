import ToolbarHeading from "@/components/ToolbarHeading.vue";
import BrowseView from "@/views/BrowseView.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { MediaType } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

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
}));
vi.mock("@/plugins/store", () => ({ store: { activePlayerId: "player" } }));

// the listing stands in as a host for the slots it normally renders around
// its items
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["showSelectButton", "loadItems"],
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

    await wrapper.findComponent({ name: "ItemsListing" }).props("loadItems")(
      {},
    );
    await nextTick();

    expect(selectButtonShown(wrapper)).toBe(false);
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

    expect(browse).toHaveBeenCalledWith("root", "player", {
      suppressGlobalError: true,
    });
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
  await wrapper.findComponent({ name: "ItemsListing" }).props("loadItems")({});
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
