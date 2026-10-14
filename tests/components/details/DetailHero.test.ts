import DetailHero from "@/components/details/DetailHero.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { track } from "../../fixtures/track";

vi.mock("@/plugins/breakpoint", () => ({ isPhoneSizedScreen: () => true }));
vi.mock("@/layouts/default/ItemContextMenu.vue", () => ({
  getContextMenuItems: vi.fn(async () => []),
}));
vi.mock("@/composables/userPreferences", () => ({
  useUserPreferences: () => ({ getPreference: () => ref([]) }),
}));
vi.mock("@/composables/useEscapeBack", () => ({ useEscapeBack: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock("@/components/Toolbar.vue", () => ({
  default: { template: "<div />" },
}));

/** Stands in for the browser's observer, so a test can say what is in view. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  targets: Element[] = [];
  constructor(
    public callback: IntersectionObserverCallback,
    public options: IntersectionObserverInit = {},
  ) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {}
  /** Reports the observed element as scrolled into or out of view. */
  report(isIntersecting: boolean) {
    const entries = this.targets.map(
      (target) => ({ target, isIntersecting }) as IntersectionObserverEntry,
    );
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

const observing = (matches: (target: Element) => boolean) =>
  FakeIntersectionObserver.instances.find((observer) =>
    observer.targets.some(matches),
  )!;

async function mountHero() {
  // the page scroller the title is measured against
  const scroller = document.createElement("div");
  scroller.className = "content-section";
  document.body.appendChild(scroller);
  const wrapper = mount(DetailHero, {
    props: { item: track({ name: "Happy Hits" }) },
    slots: { main: "<h1>Happy Hits</h1>" },
    attachTo: scroller,
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return { wrapper, scroller };
}

const pinnedBar = () =>
  document.querySelector<HTMLElement>(".content-section .fixed");
const pinnedTitle = () =>
  [...(pinnedBar()?.querySelectorAll("button") ?? [])].find(
    (button) => button.textContent?.trim() === "Happy Hits",
  );

describe("DetailHero pinned bar", () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("pins the bar once the hero's toolbar scrolls away", async () => {
    const { wrapper } = await mountHero();
    expect(pinnedBar()).toBeNull();

    observing((t) => t.tagName !== "H1").report(false);
    await wrapper.vm.$nextTick();
    expect(pinnedBar()).not.toBeNull();

    observing((t) => t.tagName !== "H1").report(true);
    await wrapper.vm.$nextTick();
    expect(pinnedBar()).toBeNull();
  });

  it("measures the title against the page scroller, below the bar", async () => {
    const { scroller } = await mountHero();
    const titleObserver = observing((t) => t.tagName === "H1");
    expect(titleObserver.options.root).toBe(scroller);
    expect(titleObserver.options.rootMargin).toBe("-56px 0px 0px 0px");
  });

  it("shows the name in the bar once the title is under it", async () => {
    const { wrapper } = await mountHero();
    observing((t) => t.tagName !== "H1").report(false);
    await wrapper.vm.$nextTick();
    expect(pinnedTitle()?.inert).toBe(true);

    observing((t) => t.tagName === "H1").report(false);
    await wrapper.vm.$nextTick();
    expect(pinnedTitle()?.inert).toBe(false);
  });
});
