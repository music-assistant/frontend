import ToolbarHeading from "@/components/ToolbarHeading.vue";
import BrowseView from "@/views/BrowseView.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

vi.mock("@/plugins/api", () => ({
  default: {
    getProviderName: (domain: string) => `${domain} provider`,
    browse: vi.fn(),
  },
}));

// only the toolbar heading is under test, so the listing stands in as a host
// for the title slot it normally forwards to the toolbar
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["showSelectButton"],
    template: '<div><slot name="title" /></div>',
  },
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

  it("offers the select button only inside a folder holding more than folders", () => {
    expect(selectButtonShown(mountBrowse())).toBe(false);
    expect(selectButtonShown(mountBrowse("root"))).toBe(false);
    expect(selectButtonShown(mountBrowse("filesystem://Music"))).toBe(true);
  });
});

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
