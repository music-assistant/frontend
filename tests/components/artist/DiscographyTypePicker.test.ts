import DiscographyTypePicker from "@/components/artist/DiscographyTypePicker.vue";
import { AlbumType } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { dropdownMenuStubs } from "../../fixtures/dropdownMenu";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, named?: { first: string; count: number }) =>
    named ? `${named.first} +${named.count}` : key,
}));

// a checkbox entry reachable without reka-ui
const DropdownMenuCheckboxItem = {
  props: ["modelValue", "disabled"],
  emits: ["update:modelValue"],
  template: `<button class="type" :data-ticked="modelValue" :disabled="disabled"
    @click="$emit('update:modelValue', !modelValue)"><slot /></button>`,
};

function mountPicker(modelValue: AlbumType[]) {
  return mount(DiscographyTypePicker, {
    props: { modelValue },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { ...dropdownMenuStubs, DropdownMenuCheckboxItem },
    },
  });
}

const typeEntry = (wrapper: ReturnType<typeof mountPicker>, type: AlbumType) =>
  wrapper
    .findAll(".type")
    .find((entry) => entry.text() === `album_type.${type}`)!;

describe("DiscographyTypePicker", () => {
  it("names the ticked types on its pill", () => {
    const wrapper = mountPicker([AlbumType.ALBUM, AlbumType.EP]);

    expect(wrapper.get("button[aria-label]").text()).toBe(
      "album_type_plural.album +1",
    );
  });

  it("asks for the clicked type to be toggled", async () => {
    const wrapper = mountPicker([AlbumType.ALBUM]);

    await typeEntry(wrapper, AlbumType.EP).trigger("click");

    expect(wrapper.emitted("toggle")).toEqual([[AlbumType.EP]]);
  });

  it("keeps the only ticked type from being unticked", () => {
    const wrapper = mountPicker([AlbumType.LIVE]);

    expect(typeEntry(wrapper, AlbumType.LIVE).attributes("disabled")).toBe("");
    expect(
      typeEntry(wrapper, AlbumType.ALBUM).attributes("disabled"),
    ).toBeUndefined();
  });
});
