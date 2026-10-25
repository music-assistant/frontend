import PlayerArtworkOnly from "@/layouts/default/PlayerOSD/PlayerArtworkOnly.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

const IMAGE = "https://artwork.test/molly.jpg";

function mountArtwork(playing = true, imageUrl = IMAGE) {
  return mount(PlayerArtworkOnly, {
    props: { imageUrl, title: "Molly", playing },
    global: { mocks: { $t: (key: string) => key }, stubs: { teleport: true } },
    attachTo: document.body,
  });
}

// An image that loads, or fails, when the test says so.
class TestImage {
  static last: TestImage | undefined;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  constructor() {
    TestImage.last = this;
  }
}

// A wake lock the test grants when it chooses, as the browser does in its own time.
function deferredWakeLock() {
  const release = vi.fn(() => Promise.resolve());
  const onRelease: (() => void)[] = [];
  let grant: () => void = () => {};
  const request = vi.fn(
    () =>
      new Promise((resolve) => {
        grant = () =>
          resolve({
            release,
            addEventListener: (_type: string, listener: () => void) =>
              onRelease.push(listener),
          });
      }),
  );
  Object.defineProperty(navigator, "wakeLock", {
    value: { request },
    configurable: true,
  });
  return {
    request,
    release,
    grant: () => grant(),
    // the system letting go of the lock on its own
    drop: () => onRelease.forEach((listener) => listener()),
  };
}

describe("PlayerArtworkOnly", () => {
  // unmounting runs the component's own cleanup, which clearing the DOM does not
  enableAutoUnmount(afterEach);
  afterEach(() => {
    document.body.innerHTML = "";
    Reflect.deleteProperty(navigator, "wakeLock");
    vi.unstubAllGlobals();
  });

  it("shows the artwork as cover and as backdrop", () => {
    const wrapper = mountArtwork();

    expect(wrapper.find(".artwork-only__cover").attributes("src")).toBe(IMAGE);
    expect(wrapper.find(".artwork-only__cover").attributes("alt")).toBe(
      "Molly",
    );
    expect(wrapper.find(".artwork-only__bg-img").attributes("src")).toBe(IMAGE);
  });

  it("leaves on a click anywhere", async () => {
    const wrapper = mountArtwork();

    await wrapper.find(".artwork-only").trigger("click");

    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("leaves on Escape without letting it close the player underneath", () => {
    const wrapper = mountArtwork();
    const onWindowKeydown = vi.fn();
    window.addEventListener("keydown", onWindowKeydown);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    window.removeEventListener("keydown", onWindowKeydown);

    expect(wrapper.emitted("close")).toHaveLength(1);
    expect(onWindowKeydown).not.toHaveBeenCalled();
  });

  it("takes the focus while open and gives it back on leaving", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const wrapper = mountArtwork();
    expect(document.activeElement).toBe(wrapper.find(".artwork-only").element);

    wrapper.unmount();
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps Tab from reaching the controls underneath", async () => {
    const wrapper = mountArtwork();
    const tab = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });

    wrapper.find(".artwork-only").element.dispatchEvent(tab);

    expect(tab.defaultPrevented).toBe(true);
  });

  it("lets go of a wake lock granted after the view was left", async () => {
    const wakeLock = deferredWakeLock();
    const wrapper = mountArtwork(true);
    expect(wakeLock.request).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    wakeLock.grant();
    await flushPromises();

    expect(wakeLock.release).toHaveBeenCalledTimes(1);
  });

  it("asks again for a wake lock the system let go of while playing", async () => {
    const wakeLock = deferredWakeLock();
    mountArtwork(true);
    wakeLock.grant();
    await flushPromises();

    wakeLock.drop();
    await flushPromises();

    expect(wakeLock.request).toHaveBeenCalledTimes(2);
  });

  it("changes to a new cover once it has loaded", async () => {
    vi.stubGlobal("Image", TestImage);
    const next = "https://artwork.test/next.jpg";
    const wrapper = mountArtwork();

    await wrapper.setProps({ imageUrl: next });
    expect(wrapper.find(".artwork-only__cover").attributes("src")).toBe(IMAGE);

    TestImage.last?.onload?.();
    await nextTick();
    expect(wrapper.find(".artwork-only__cover").attributes("src")).toBe(next);
  });

  it("keeps the cover when the new one fails to load", async () => {
    vi.stubGlobal("Image", TestImage);
    const wrapper = mountArtwork();

    await wrapper.setProps({ imageUrl: "https://artwork.test/broken.jpg" });
    TestImage.last?.onerror?.();
    await nextTick();

    expect(wrapper.find(".artwork-only__cover").attributes("src")).toBe(IMAGE);
  });

  it("holds the backdrop still while the music is paused", () => {
    expect(mountArtwork(false).find(".artwork-only").classes()).toContain(
      "artwork-only--paused",
    );
    expect(mountArtwork(true).find(".artwork-only").classes()).not.toContain(
      "artwork-only--paused",
    );
  });

  it("shows no cover when there is no artwork", () => {
    expect(mountArtwork(true, "").find("img").exists()).toBe(false);
  });
});
