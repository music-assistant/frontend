import PlayerArtworkOnly from "@/layouts/default/PlayerOSD/PlayerArtworkOnly.vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

const IMAGE = "https://artwork.test/molly.jpg";

function mountArtwork(playing = true, imageUrl = IMAGE) {
  return mount(PlayerArtworkOnly, {
    props: { imageUrl, title: "Molly", playing },
    global: { mocks: { $t: (key: string) => key }, stubs: { teleport: true } },
    attachTo: document.body,
  });
}

describe("PlayerArtworkOnly", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the artwork as cover and as backdrop", () => {
    const wrapper = mountArtwork();

    expect(wrapper.find(".artwork-only__cover").attributes("src")).toBe(IMAGE);
    expect(wrapper.find(".artwork-only__cover").attributes("alt")).toBe(
      "Molly",
    );
    expect(wrapper.find(".artwork-only__bg-img").attributes("src")).toBe(IMAGE);
    wrapper.unmount();
  });

  it("leaves on a click anywhere", async () => {
    const wrapper = mountArtwork();

    await wrapper.find(".artwork-only").trigger("click");

    expect(wrapper.emitted("close")).toHaveLength(1);
    wrapper.unmount();
  });

  it("leaves on Escape", async () => {
    const wrapper = mountArtwork();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(wrapper.emitted("close")).toHaveLength(1);
    wrapper.unmount();
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
