import TrackTableLinks from "@/components/track-table/TrackTableLinks.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineComponent, h } from "vue";

const blank = { template: "<div />" };

const ARTISTS = [
  { item_id: "1", provider: "library", name: "Tame Impala", uri: "a://1" },
  { item_id: "2", provider: "spotify", name: "JENNIE", uri: "a://2" },
];

/** The links inside a parent that, like a track row, opens on click. */
async function mountInRow() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "root", component: blank },
      { path: "/artists/:provider/:itemId", name: "artist", component: blank },
      { path: "/albums/:provider/:itemId", name: "album", component: blank },
    ],
  });
  await router.push("/");
  const onRowClick = vi.fn();
  const onRowMenu = vi.fn();
  const Row = defineComponent(
    () => () =>
      h("div", { onClick: onRowClick, onContextmenu: onRowMenu }, [
        h(TrackTableLinks, { targets: ARTISTS, routeName: "artist" }),
      ]),
  );
  const wrapper = mount(Row, { global: { plugins: [router] } });
  return { wrapper, router, onRowClick, onRowMenu };
}

describe("TrackTableLinks", () => {
  it("links every name to its own page", async () => {
    const { wrapper } = await mountInRow();
    const links = wrapper.findAll("a");
    expect(links.map((link) => link.text())).toEqual(["Tame Impala", "JENNIE"]);
    expect(links[1].attributes("href")).toBe("/artists/spotify/2");
    expect(wrapper.text()).toContain("Tame Impala | JENNIE");
  });

  it("opens the artist without opening the row as well", async () => {
    const { wrapper, router, onRowClick } = await mountInRow();
    await wrapper.findAll("a")[0].trigger("click");
    await router.isReady();
    await vi.waitFor(() =>
      expect(router.currentRoute.value.params).toEqual({
        provider: "library",
        itemId: "1",
      }),
    );
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("leaves a right click to the browser instead of the row menu", async () => {
    const { wrapper, onRowMenu } = await mountInRow();
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    wrapper.findAll("a")[0].element.dispatchEvent(event);
    expect(onRowMenu).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
