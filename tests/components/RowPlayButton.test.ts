import RowPlayButton from "@/components/RowPlayButton.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

// a screen that hovers, or a touch screen where nothing does
function onScreen(touch: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(hover: none)" && touch,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

const mountButton = (overlay: boolean) =>
  mount(RowPlayButton, {
    props: { label: "play One", overlay },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RowPlayButton", () => {
  // the overlay shows on hover, the row's own button where nothing hovers
  it.each([
    [true, false, true],
    [true, true, false],
    [false, false, false],
    [false, true, true],
  ])("overlay %s, touch screen %s: shown %s", async (overlay, touch, shown) => {
    onScreen(touch);
    const wrapper = mountButton(overlay);
    // the media query is read once mounted
    await flushPromises();
    const button = wrapper.find("button");

    expect(button.exists()).toBe(shown);
    if (shown) expect(button.attributes("aria-label")).toBe("play One");
  });

  it("plays without the click reaching the row", async () => {
    onScreen(false);
    const rowClicked = vi.fn();
    const wrapper = mount(
      {
        components: { RowPlayButton },
        template:
          '<div @click="rowClicked"><RowPlayButton label="play One" overlay @click="played" /></div>',
        methods: { rowClicked, played: vi.fn() },
      },
      { attachTo: document.body },
    );

    await wrapper.get("button").trigger("click");

    expect(wrapper.findComponent(RowPlayButton).emitted("click")).toHaveLength(
      1,
    );
    expect(rowClicked).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
