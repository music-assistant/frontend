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

    const remove = wrapper.get('[data-testid="storage-remove"]');
    expect(remove.attributes("disabled")).toBeDefined();
    // the row does not name the source, so the reason does
    expect(wrapper.get('[data-testid="storage-used-by"]').text()).toBe(
      "Local files uses this location. Disable or remove that music source first.",
    );
    expect(removeHint(wrapper)).toBe(
      "Local files uses this location. Disable or remove that music source first.",
    );
    expect(
      wrapper.get(`#${remove.attributes("aria-describedby")}`).text(),
    ).toBe(
      "Local files uses this location. Disable or remove that music source first.",
    );
  });

  it("says on the row why a location in use can not be removed", () => {
    const wrapper = mountRow(managedShare({ used_by: ["Local files"] }));

    const usedBy = wrapper.get('[data-testid="storage-used-by"]');
    expect(usedBy.text()).toBe(
      "Local files uses this location. Disable or remove that music source first.",
    );
    expect(
      wrapper
        .get('[data-testid="storage-remove"]')
        .attributes("aria-describedby"),
    ).toBe(usedBy.attributes("id"));
  });

  it("names the users of a location that can not be removed at all", () => {
    const wrapper = mountRow(
      storageLocation({ path: "/media", used_by: ["Local files"] }),
    );

    expect(wrapper.find('[data-testid="storage-remove"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="storage-used-by"]').text()).toBe(
      "Used by Local files",
    );
  });

  it("offers to use the location as a music source, named after the location", async () => {
    const wrapper = mountRow(managedShare(), undefined, true);

    const button = wrapper.get('[data-testid="storage-use-as-source"]');
    expect(button.text()).toBe("Use as music source");
    // the name and tooltip tell the buttons of several rows apart, also on a
    // phone where the label is hidden
    expect(button.attributes("aria-label")).toBe(
      "Use as music source: NAS music",
    );
    expect(button.attributes("title")).toBe("Use as music source: NAS music");
    await button.trigger("click");

    expect(wrapper.emitted("useAsSource")).toHaveLength(1);
  });

  it("offers nothing to use as a music source unless told to", () => {
    const wrapper = mountRow(managedShare());

    expect(wrapper.find('[data-testid="storage-use-as-source"]').exists()).toBe(
      false,
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

function mountRow(
  location: StorageLocation,
  shownUsedBy?: string[],
  canUseAsSource?: boolean,
) {
  return mount(StorageLocationRow, {
    props: { location, shownUsedBy, canUseAsSource },
    global: { plugins: [i18n] },
  });
}

/** The tooltip beside Remove, on the wrapper since a disabled button takes no pointer. */
function removeHint(wrapper: ReturnType<typeof mountRow>) {
  return wrapper
    .get('[data-testid="storage-remove"]')
    .element.parentElement?.getAttribute("title");
}
