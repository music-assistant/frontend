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
// only the item named "With art" has artwork of its own
vi.mock("@/helpers/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/helpers/utils")>()),
  getImageThumbForItem: (item?: { name?: string }) =>
    item?.name === "With art" ? "cover.jpg" : undefined,
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

describe("DetailHero backdrop", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const backdropOf = (props: Record<string, unknown>) =>
    mount(DetailHero, {
      props: { item: track(), backdrop: "fanart.jpg", ...props },
      global: { mocks: { $t: (key: string) => key } },
    }).get(".detail-hero__backdrop");

  it("softens a picture when asked", () => {
    expect(backdropOf({ softenBackdrop: true }).classes()).toContain(
      "blur-[6px]",
    );
    expect(backdropOf({}).classes()).not.toContain("blur-[6px]");
  });

  it("keeps the heavy blur alone for art that only stands in", () => {
    const backdrop = backdropOf({ softenBackdrop: true, blurBackdrop: true });
    expect(backdrop.classes()).toContain("detail-hero__backdrop--blurred");
    expect(backdrop.classes()).not.toContain("blur-[6px]");
  });
});

describe("DetailHero on a phone", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const heroFor = (name: string) =>
    mount(DetailHero, {
      props: { item: track({ name }), backdrop: "fanart.jpg" },
      slots: { main: '<div class="detail-hero-cover" /><h1>{{ name }}</h1>' },
      global: { mocks: { $t: (key: string) => key } },
    });

  it("lays the item's own artwork across the top, in place of its cover", () => {
    const hero = heroFor("With art");
    const backdrop = hero.get(".detail-hero__backdrop");

    expect(backdrop.attributes("style")).toContain("cover.jpg");
    expect(backdrop.classes()).toContain("aspect-square");
    expect(hero.get(".detail-hero__main").classes()).toContain(
      "[&_.detail-hero-cover]:hidden",
    );
  });

  it("keeps the usual backdrop for an item without artwork", () => {
    const hero = heroFor("No art");
    const backdrop = hero.get(".detail-hero__backdrop");

    expect(backdrop.attributes("style")).toContain("fanart.jpg");
    expect(backdrop.classes()).not.toContain("aspect-square");
    expect(hero.get(".detail-hero__main").classes()).not.toContain(
      "[&_.detail-hero-cover]:hidden",
    );
  });
});
