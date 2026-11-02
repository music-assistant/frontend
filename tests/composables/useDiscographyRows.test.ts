import type { ArtistRowId } from "@/components/artist/artistRows";
import { useDiscographyRows } from "@/composables/useDiscographyRows";
import type { Album } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { album } from "../fixtures/album";

vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string, named?: Record<string, unknown>) =>
    named ? `${key}(${Object.values(named).join(",")})` : key,
}));

/** The page's discography rows with these items, undefined while loading. */
function setup(
  rows: ArtistRowId[],
  first: Album[] | undefined = [album()],
  second: Album[] | undefined = [album()],
) {
  return useDiscographyRows(ref(rows), {
    discography: ref(first),
    discography_second: ref(second),
  });
}

describe("useDiscographyRows", () => {
  beforeEach(() => {
    store.currentUser = undefined;
  });

  it("heads two rows next to each other once, and tightens the gap between them", () => {
    const rows = setup(["albums", "discography", "discography_second"]);

    expect(rows.showsHeading("discography")).toBe(true);
    expect(rows.showsHeading("discography_second")).toBe(false);
    expect(rows.continuesBelow("discography")).toBe(true);
    expect(rows.continuesBelow("discography_second")).toBe(false);
  });

  it("heads each row once they are apart", () => {
    const rows = setup(["discography", "appears_on", "discography_second"]);

    expect(rows.showsHeading("discography")).toBe(true);
    expect(rows.showsHeading("discography_second")).toBe(true);
    expect(rows.continuesBelow("discography")).toBe(false);
  });

  it("hands the heading to the second row when the first comes up empty", () => {
    const rows = setup(["discography", "discography_second"], []);

    expect(rows.isShown("discography")).toBe(false);
    expect(rows.showsHeading("discography_second")).toBe(true);
  });

  it("keeps a row shown while it loads", () => {
    const rows = setup(["discography", "discography_second"], undefined);

    expect(rows.isShown("discography")).toBe(true);
    expect(rows.rowItems.value.discography).toBeUndefined();
    expect(rows.showsHeading("discography_second")).toBe(false);
  });

  it("describes each row's types for the rows editor, with its count once loaded", () => {
    const rows = setup(
      ["discography", "discography_second"],
      [album(), album()],
      undefined,
    );

    expect(rows.meta("discography")).toBe("album_type_plural.album · 2");
    expect(rows.meta("discography_second")).toBe("album_type_plural.live");
  });
});
