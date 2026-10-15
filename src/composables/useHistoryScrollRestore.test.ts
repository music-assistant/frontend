import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, reactive, ref } from "vue";
import { useHistoryScrollRestore } from "./useHistoryScrollRestore";

type Guard = (to: unknown, from: { fullPath: string }) => void;

const { routerMock, guards, historyMock } = vi.hoisted(() => ({
  routerMock: {},
  guards: { leave: [] as Guard[] },
  historyMock: { returned: false },
}));

const route = reactive({ fullPath: "/artists/library/1" });

vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => routerMock,
  onBeforeRouteLeave: (guard: Guard) => guards.leave.push(guard),
  onBeforeRouteUpdate: vi.fn(),
}));
vi.mock("@/helpers/navigation", () => ({
  returnedByHistory: () => historyMock.returned,
}));

let resize: () => void = () => {};
class ResizeObserverMock {
  constructor(private callback: () => void) {}
  observe() {
    resize = this.callback;
  }
  disconnect() {
    if (resize === this.callback) resize = () => {};
  }
}

describe("useHistoryScrollRestore", () => {
  let scroller: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    scroller = document.createElement("div");
    scroller.className = "content-section";
    Object.defineProperty(scroller, "clientHeight", { value: 500 });
    document.body.appendChild(scroller);
    guards.leave = [];
    resize = () => {};
    historyMock.returned = false;
  });

  afterEach(() => {
    scroller.remove();
    vi.unstubAllGlobals();
  });

  function mount() {
    const scope = effectScope();
    const restore = scope.run(() =>
      useHistoryScrollRestore(ref(document.createElement("section"))),
    )!;
    return { scope, restore };
  }

  function setContentHeight(height: number) {
    Object.defineProperty(scroller, "scrollHeight", {
      value: height,
      configurable: true,
    });
  }

  function leaveAt(top: number) {
    const { scope } = mount();
    scroller.scrollTop = top;
    guards.leave.forEach((guard) => guard({}, { fullPath: route.fullPath }));
    scope.stop();
    scroller.scrollTop = 0;
  }

  it("returns to the saved position once the content is tall enough", async () => {
    leaveAt(1200);
    historyMock.returned = true;
    setContentHeight(800);
    const { restore } = mount();
    await nextTick();

    resize();
    expect(scroller.scrollTop).toBe(0);

    setContentHeight(2000);
    resize();
    expect(scroller.scrollTop).toBe(1200);
    // stays set after the restore so a late item load doesn't reset the page
    expect(restore.returning()).toBe(true);
  });

  it("gives up when the user grabs the page before the content is tall enough", async () => {
    leaveAt(1200);
    historyMock.returned = true;
    setContentHeight(800);
    mount();
    await nextTick();

    scroller.dispatchEvent(new Event("pointerdown"));
    setContentHeight(2000);
    resize();
    expect(scroller.scrollTop).toBe(0);
  });

  it("leaves a fresh navigation alone", async () => {
    leaveAt(1200);
    historyMock.returned = false;
    setContentHeight(2000);
    const { restore } = mount();
    await nextTick();

    resize();
    expect(scroller.scrollTop).toBe(0);
    expect(restore.returning()).toBe(false);
  });
});
