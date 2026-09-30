import StoragePath from "@/components/settings/storage/StoragePath.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("StoragePath", () => {
  it("shows the path exactly as it is", () => {
    const path = "/private/tmp/ma-storage-demo/Music/OK Computer (1997)";

    const wrapper = mount(StoragePath, { props: { path } });

    expect(wrapper.element.textContent).toBe(path);
  });

  it("lets a line break after each slash rather than inside a name", () => {
    const wrapper = mount(StoragePath, {
      props: { path: "/media/music/Albums" },
    });

    const pieces = wrapper.findAll("span.inline-block");
    expect(pieces.map((piece) => piece.text())).toEqual([
      "/media/",
      "music/",
      "Albums",
    ]);
    // a single name longer than the line may still wrap inside itself
    expect(wrapper.classes()).toContain("wrap-anywhere");
  });
});
