import RotationRefPicker from "@/components/rotation/RotationRefPicker.vue";
import api from "@/plugins/api";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({
  default: {
    getItemByUri: vi.fn(),
    getLibraryArtists: vi.fn(),
    getLibraryAlbums: vi.fn(),
    getLibraryGenres: vi.fn(async () => []),
  },
}));

enableAutoUnmount(afterEach);

const getItemByUri = vi.mocked(api.getItemByUri);
const getLibraryArtists = vi.mocked(api.getLibraryArtists);

beforeEach(() => {
  vi.clearAllMocks();
  getItemByUri.mockImplementation(async (uri: string) => {
    if (uri === "library://artist/7") {
      return { name: "Die drei ???" } as never;
    }
    throw new Error("not found");
  });
});

describe("RotationRefPicker", () => {
  it("resolves a saved uri to the name of the item", async () => {
    const wrapper = mount(RotationRefPicker, {
      props: { field: "artist", modelValue: "library://artist/7" },
    });
    await flushPromises();
    expect(wrapper.text()).toContain("Die drei ???");
  });

  it("falls back to the id of an unknown uri", async () => {
    const wrapper = mount(RotationRefPicker, {
      props: { field: "artist", modelValue: "library://artist/8" },
    });
    await flushPromises();
    expect(wrapper.text()).toContain("8");
  });

  it("emits the uri of the picked item", async () => {
    getLibraryArtists.mockResolvedValue([
      { uri: "library://artist/7", name: "Die drei ???" },
    ] as never);
    const wrapper = mount(RotationRefPicker, {
      props: { field: "artist" },
      attachTo: document.body,
    });
    const trigger = wrapper.get("button");
    await trigger.trigger("pointerdown", { button: 0, pointerType: "mouse" });
    await trigger.trigger("click");
    const input = await vi.waitFor(() => {
      const el = document.querySelector<HTMLInputElement>(
        "[data-slot='popover-content'] input",
      );
      expect(el).not.toBeNull();
      return el!;
    });
    input.value = "drei";
    input.dispatchEvent(new Event("input"));
    const row = await vi.waitFor(
      () => {
        const el = document.querySelector<HTMLButtonElement>(
          "[data-slot='popover-content'] button",
        );
        expect(el).not.toBeNull();
        return el!;
      },
      { timeout: 2000 },
    );
    row.click();
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")![0]).toEqual([
      "library://artist/7",
    ]);
  });

  it("offers the audio qualities without a search field", async () => {
    const wrapper = mount(RotationRefPicker, {
      props: { field: "audio_quality" },
      attachTo: document.body,
    });
    const trigger = wrapper.get("button");
    await trigger.trigger("pointerdown", { button: 0, pointerType: "mouse" });
    await trigger.trigger("click");
    const rows = await vi.waitFor(() => {
      const els = document.querySelectorAll<HTMLButtonElement>(
        "[data-slot='popover-content'] button",
      );
      expect(els.length).toBeGreaterThan(0);
      return [...els];
    });
    expect(rows.map((row) => row.textContent?.trim())).toEqual([
      "Lossy",
      "Lossless",
      "Hi-res",
    ]);
    expect(
      document.querySelector("[data-slot='popover-content'] input"),
    ).toBeNull();
    rows[2]!.click();
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")![0]).toEqual(["hi_res"]);
  });

  it("shows the label of a saved audio quality", async () => {
    const wrapper = mount(RotationRefPicker, {
      props: { field: "audio_quality", modelValue: "lossless" },
    });
    await flushPromises();
    expect(wrapper.text()).toContain("Lossless");
    expect(getItemByUri).not.toHaveBeenCalled();
  });
});
