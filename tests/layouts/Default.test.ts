import Default from "@/layouts/default/Default.vue";
import View from "@/layouts/default/View.vue";
import Footer from "@/layouts/default/Footer.vue";
import { store } from "@/plugins/store";
import { type VueWrapper, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      frameless: false,
      activePlayerId: undefined,
      showFullscreenPlayer: false,
    }),
  };
});

const vuetify = createVuetify({ components, directives });

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: "/", component: { template: "<div />" } }],
});

let wrapper: VueWrapper | undefined;

async function mountLayout() {
  await router.push("/");
  await router.isReady();
  wrapper = mount(Default, {
    shallow: true,
    global: {
      plugins: [vuetify, router],
      // v-app hosts the whole tree, so it has to render its slot
      stubs: { VApp: { template: "<div><slot /></div>" } },
    },
  });
  return wrapper;
}

describe("Default layout", () => {
  beforeEach(() => {
    store.frameless = false;
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("drops the player chrome in frameless mode", async () => {
    const layout = await mountLayout();
    expect(layout.findComponent(Footer).exists()).toBe(true);

    store.frameless = true;
    await nextTick();

    expect(layout.findComponent(Footer).exists()).toBe(false);
  });

  it("keeps the view mounted across a frameless toggle", async () => {
    const layout = await mountLayout();
    // the party dashboard lives in here and holds a wake lock, a burn-in timer
    // and fetched config, so going fullscreen must not restart it
    const view = layout.findComponent(View).element;

    store.frameless = true;
    await nextTick();

    expect(layout.findComponent(View).element).toBe(view);
  });
});
