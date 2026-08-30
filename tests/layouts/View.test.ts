import View from "@/layouts/default/View.vue";
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
  return { store: reactive({ mobileLayout: false, frameless: false }) };
});

vi.mock("@/plugins/eventbus", () => ({
  eventbus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
}));

const vuetify = createVuetify({ components, directives });

// the content section is nested in wrappers that carry no state of their own,
// so they stand in as plain hosts while every other child is shallow-stubbed
const host = { template: "<div><slot /></div>" };
const blank = { template: "<div />" };

// the app's own party route is guarded on a live server connection, so the
// layout is exercised against the route shape it has to read: meta on a child
// of the record the layout itself is mounted by
const testRoutes = [
  { path: "/", component: blank },
  {
    path: "/party",
    component: blank,
    children: [{ path: "", component: blank, meta: { partyView: true } }],
  },
];

let wrapper: VueWrapper | undefined;

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: testRoutes,
  });
  await router.push(path);
  await router.isReady();
  wrapper = mount(View, {
    shallow: true,
    global: {
      plugins: [vuetify, router],
      stubs: { VMain: host, SidebarProvider: host, SidebarInset: host },
    },
  });
  return { section: wrapper.get(".content-section"), router };
}

describe("View", () => {
  beforeEach(() => {
    store.mobileLayout = false;
    store.frameless = false;
  });

  afterEach(() => {
    // the store is shared, so an instance left mounted would react to the
    // next test's state
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("marks the content section for a view that fills it", async () => {
    const { section } = await mountAt("/party");

    expect(section.classes()).toContain("party-view-active");
  });

  it("leaves the content section unmarked for a regular view", async () => {
    const { section } = await mountAt("/");

    expect(section.classes()).not.toContain("party-view-active");
  });

  it("follows the route without being remounted", async () => {
    // navigating between the app's routes patches this instance in place, so
    // the mark has to track the route rather than settle at first render
    const { section, router } = await mountAt("/");

    await router.push("/party");
    await nextTick();
    expect(section.classes()).toContain("party-view-active");

    await router.push("/");
    await nextTick();
    expect(section.classes()).not.toContain("party-view-active");
  });

  it.each([
    ["mobileLayout", "content-section--mobile"],
    ["frameless", "content-section--frameless"],
  ] as const)("keeps the mark when %s changes under it", async (flag, mod) => {
    const { section } = await mountAt("/party");

    // vue patches this class by assigning className, so the mark only survives
    // a change to its siblings by being part of the same binding
    store[flag] = true;
    await nextTick();

    expect(section.classes()).toContain(mod);
    expect(section.classes()).toContain("party-view-active");
  });
});
