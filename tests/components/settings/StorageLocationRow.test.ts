import StorageLocationRow from "@/components/settings/storage/StorageLocationRow.vue";
import { StorageKind, type StorageLocation } from "@/plugins/api/interfaces";
import { i18n } from "@/plugins/i18n";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { managedShare, storageLocation } from "../../fixtures/storage";

describe("StorageLocationRow", () => {
  it("tells to disable or remove the one source that uses the location", () => {
    const wrapper = mountRow(managedShare({ used_by: ["Local files"] }));

    expect(removeHint(wrapper)).toBe(
      "Local files uses this location. Disable or remove that music source first.",
    );
  });

  it("tells to disable or remove the sources that use the location", () => {
    const wrapper = mountRow(
      managedShare({ used_by: ["Audiobooks", "Local files"] }),
    );

    expect(removeHint(wrapper)).toBe(
      "Audiobooks and Local files use this location. Disable or remove those music sources first.",
    );
  });

  it("names only the sources it is given, and stays blocked by all of them", () => {
    const wrapper = mountRow(
      storageLocation({
        path: "/media/music",
        name: "Music",
        kind: StorageKind.MANUAL,
        managed: true,
        used_by: ["Local files"],
      }),
      [],
    );

    expect(wrapper.find('[data-testid="storage-used-by"]').exists()).toBe(
      false,
    );
    const remove = wrapper.get('[data-testid="storage-remove"]');
    expect(remove.attributes("disabled")).toBeDefined();
    // the row does not name the source, so the reason does
    expect(removeHint(wrapper)).toBe(
      "Local files uses this location. Disable or remove that music source first.",
    );
    expect(
      wrapper.get(`#${remove.attributes("aria-describedby")}`).text(),
    ).toBe(
      "Local files uses this location. Disable or remove that music source first.",
    );
  });

  it("reads the sources that only read through the location as such", () => {
    const wrapper = mountRow(managedShare({ read_by: ["Local files"] }));

    expect(wrapper.get('[data-testid="storage-read-by"]').text()).toBe(
      "Also read by Local files",
    );
    expect(removeHint(wrapper)).toBe("Remove: NAS music");
  });
});

function mountRow(location: StorageLocation, shownUsedBy?: string[]) {
  return mount(StorageLocationRow, {
    props: { location, shownUsedBy },
    global: { plugins: [i18n] },
  });
}

/** The tooltip beside Remove, on the wrapper since a disabled button takes no pointer. */
function removeHint(wrapper: ReturnType<typeof mountRow>) {
  return wrapper
    .get('[data-testid="storage-remove"]')
    .element.parentElement?.getAttribute("title");
}
