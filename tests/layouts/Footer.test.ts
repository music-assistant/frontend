import Footer from "@/layouts/default/Footer.vue";
import { store } from "@/plugins/store";
import { mount } from "@vue/test-utils";
import { h, nextTick } from "vue";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { playerBarHeight } = await vi.hoisted(async () => {
  const { ref } = await import("vue");
  return { playerBarHeight: ref(0) };
});

vi.mock("@vueuse/core", async () => {
  const actual =
    await vi.importActual<typeof import("@vueuse/core")>("@vueuse/core");
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    useElementSize: () => ({ width: ref(0), height: playerBarHeight }),
  };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({ mobileLayout: false, showPlayersMenu: false }),
  };
});

const vuetify = createVuetify({ components, directives });

const OVERLAY_HEIGHT = "--player-bar-overlay-height";

function overlayHeight() {
  return document.documentElement.style.getPropertyValue(OVERLAY_HEIGHT);
}

// v-footer registers itself as an app layout item, so it needs a layout host
function mountFooter() {
  return mount(
    {
      render: () => h(components.VLayout, null, { default: () => h(Footer) }),
    },
    {
      global: {
        plugins: [vuetify],
        stubs: { BottomNavigation: true, Player: true },
      },
    },
  );
}

describe("Footer", () => {
  beforeEach(() => {
    store.mobileLayout = false;
    playerBarHeight.value = 0;
    document.documentElement.style.removeProperty(OVERLAY_HEIGHT);
  });

  afterEach(() => {
    document.documentElement.style.removeProperty(OVERLAY_HEIGHT);
  });

  it("publishes the floating player bar height so popouts can clear it", async () => {
    store.mobileLayout = true;
    playerBarHeight.value = 118.4;
    mountFooter();
    await nextTick();

    expect(overlayHeight()).toBe("119px");
  });

  it("tracks the player bar as it resizes", async () => {
    store.mobileLayout = true;
    playerBarHeight.value = 118;
    mountFooter();
    await nextTick();

    playerBarHeight.value = 64;
    await nextTick();

    expect(overlayHeight()).toBe("64px");
  });

  it("reserves no room on desktop, where the popouts sit above the player bar", async () => {
    playerBarHeight.value = 104;
    mountFooter();
    await nextTick();

    expect(overlayHeight()).toBe("0px");
  });

  it("stops reserving room once the player bar is gone", async () => {
    store.mobileLayout = true;
    playerBarHeight.value = 118;
    const wrapper = mountFooter();
    await nextTick();

    wrapper.unmount();
    await nextTick();

    expect(overlayHeight()).toBe("");
  });
});
