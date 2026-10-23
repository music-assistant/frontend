import RemoveLocationDialog from "@/components/settings/storage/RemoveLocationDialog.vue";
import { StorageKind, type StorageLocation } from "@/plugins/api/interfaces";
import { i18n } from "@/plugins/i18n";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { managedShare, storageLocation } from "../../fixtures/storage";

// an open dialog keeps document-level focus trap listeners, so tear it down
// even when an assertion fails
enableAutoUnmount(afterEach);

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("RemoveLocationDialog", () => {
  it("warns that a source reading the share loses its items", async () => {
    await openDialog(managedShare({ read_by: ["Local files"] }));

    expect(warning()).toBe(
      "Local files also reads this share. Its items from this share leave the library at the next sync.",
    );
  });

  it("warns in the plural when several sources read the share", async () => {
    await openDialog(managedShare({ read_by: ["Audiobooks", "Local files"] }));

    expect(warning()).toBe(
      "Audiobooks and Local files also read this share. Their items from this share leave the library at the next sync.",
    );
  });

  it("has no warning for a share nobody else reads", async () => {
    await openDialog(managedShare());

    expect(warning()).toBeNull();
    expect(description()).toContain("Music Assistant disconnects the share.");
  });

  // removing a registered folder only takes it off the list; its files stay
  it("never warns before a folder is removed", async () => {
    await openDialog(
      storageLocation({
        path: "/home/me/Music",
        name: "Music",
        kind: StorageKind.MANUAL,
        managed: true,
        read_by: ["Local files"],
      }),
    );

    expect(warning()).toBeNull();
    expect(description()).toContain(
      "The folder and its files are not deleted.",
    );
  });
});

async function openDialog(location: StorageLocation) {
  mount(RemoveLocationDialog, {
    props: { location },
    attachTo: document.body,
    global: { plugins: [i18n] },
  });
  await flushPromises();
}

function description() {
  return (
    document.querySelector('[data-slot="alert-dialog-description"]')
      ?.textContent ?? ""
  );
}

function warning() {
  return (
    document
      .querySelector('[data-testid="storage-remove-read-by"]')
      ?.textContent?.trim() ?? null
  );
}
