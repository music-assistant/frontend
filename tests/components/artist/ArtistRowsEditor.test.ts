import ArtistRowsEditor from "@/components/artist/ArtistRowsEditor.vue";
import type { ArtistRowId } from "@/components/artist/artistRows";
import {
  ProviderFeature,
  ProviderType,
  type Artist,
} from "@/plugins/api/interfaces";
import { mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { artist } from "../../fixtures/artist";

const {
  apiMock,
  buttonStub,
  mockEffectiveArtistRowSource,
  mockIsPhoneSizedScreen,
  mockResetArtistRows,
  mockResolveArtistRows,
  mockSetArtistRowHidden,
  mockSetArtistRowSource,
  passthrough,
} = vi.hoisted(() => ({
  passthrough: { template: "<div><slot /></div>" },
  buttonStub: { template: "<button><slot /></button>" },
  apiMock: {
    providers: {} as Record<string, unknown>,
  },
  mockEffectiveArtistRowSource: vi.fn(),
  mockIsPhoneSizedScreen: vi.fn(),
  mockResetArtistRows: vi.fn(),
  mockResolveArtistRows: vi.fn(),
  mockSetArtistRowHidden: vi.fn(),
  mockSetArtistRowSource: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));

// row titles are translated in the component, so the keys are what the
// assertions read and they stay independent of en.json
vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string) => key,
}));

// the registry itself (labels, which rows get a source picker) stays real; only
// the preference reads and writes are stubbed
vi.mock("@/components/artist/artistRows", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/artist/artistRows")>()),
  resolveArtistRows: mockResolveArtistRows,
  effectiveArtistRowSource: mockEffectiveArtistRowSource,
  setArtistRowHidden: mockSetArtistRowHidden,
  setArtistRowSource: mockSetArtistRowSource,
  resetArtistRows: mockResetArtistRows,
}));

vi.mock("@/plugins/breakpoint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/breakpoint")>()),
  isPhoneSizedScreen: mockIsPhoneSizedScreen,
}));

// the real dialog only mounts its content while it is open, so the stub does too
vi.mock("@/components/ui/dialog", () => ({
  Dialog: {
    props: ["open"],
    template: "<div v-if='open'><slot /></div>",
  },
  DialogContent: passthrough,
  DialogTitle: passthrough,
  DialogDescription: passthrough,
}));
vi.mock("@/components/ui/sheet", () => ({ SheetContent: passthrough }));
vi.mock("@/components/ui/button", () => ({ Button: buttonStub }));
vi.mock("@/components/ui/badge", () => ({ Badge: passthrough }));
vi.mock("@/components/ui/switch", () => ({
  Switch: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<button role="switch" @click="$emit('update:modelValue', !modelValue)" />`,
  },
}));
// the radio items report the sources on offer and select through their group
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: passthrough,
  DropdownMenuTrigger: passthrough,
  DropdownMenuContent: passthrough,
  DropdownMenuRadioGroup: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    provide() {
      const group = this as unknown as {
        $emit: (event: string, value: string) => void;
      };
      return {
        pickSource: (value: string) => group.$emit("update:modelValue", value),
      };
    },
    template: "<div :data-current='modelValue'><slot /></div>",
  },
  DropdownMenuRadioItem: {
    props: ["value"],
    inject: ["pickSource"],
    template:
      "<button :data-source='value' @click='pickSource(value)'><slot /></button>",
  },
}));
vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: { props: ["domain"], template: "<i :data-domain='domain' />" },
}));
vi.mock("@/components/PanelDragHandle.vue", () => ({
  default: { template: "<div />" },
}));

const ARTIST: Artist = artist({
  provider_mappings: [
    {
      item_id: "1",
      provider_domain: "spotify",
      provider_instance: "spotify--1",
      available: true,
      in_library: null,
      audio_format: {} as never,
      details: null,
      url: null,
    },
  ],
});

function mountEditor(availableIds: ArtistRowId[], item: Artist = ARTIST) {
  return mount(ArtistRowsEditor, {
    props: { open: true, artist: item, availableIds },
    global: { mocks: { $t: (key: string) => key } },
  });
}

function rows(wrapper: VueWrapper) {
  return wrapper.findAll("[data-drag-index]");
}

function buttonWithText(wrapper: VueWrapper, text: string) {
  return wrapper.findAll("button").find((btn) => btn.text().includes(text));
}

describe("ArtistRowsEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // the sources on offer come from the providers the artist is mapped to that
    // can actually supply the row
    apiMock.providers = {
      "spotify--1": {
        instance_id: "spotify--1",
        name: "Spotify",
        domain: "spotify",
        type: ProviderType.MUSIC,
        supported_features: [
          ProviderFeature.ARTIST_ALBUMS,
          ProviderFeature.ARTIST_TOPTRACKS,
        ],
      },
    };
    mockIsPhoneSizedScreen.mockReturnValue(false);
    mockEffectiveArtistRowSource.mockReturnValue("all");
    mockResolveArtistRows.mockImplementation((availableIds: ArtistRowId[]) => ({
      order: availableIds,
      hidden: new Set<ArtistRowId>(),
    }));
  });

  it("renders the rows in the saved order, hidden ones dimmed in place", () => {
    mockResolveArtistRows.mockReturnValue({
      order: ["albums", "bio", "top_tracks"],
      hidden: new Set(["bio"]),
    });

    const wrapper = mountEditor(["bio", "top_tracks", "albums"]);

    expect(rows(wrapper).map((row) => row.text())).toEqual([
      expect.stringContaining("albums"),
      expect.stringContaining("biography"),
      expect.stringContaining("artist_toptracks"),
    ]);
    const hiddenRow = rows(wrapper)[1];
    expect(hiddenRow.find(".rows-editor__row--hidden").exists()).toBe(true);
    expect(hiddenRow.text()).toContain("row_hidden");
    expect(rows(wrapper)[0].find(".rows-editor__row--hidden").exists()).toBe(
      false,
    );
  });

  it("hides a row from its eye toggle and shows it again", async () => {
    mockResolveArtistRows.mockReturnValue({
      order: ["albums", "bio"],
      hidden: new Set(["bio"]),
    });

    const wrapper = mountEditor(["bio", "albums"]);
    await wrapper.get('[aria-label="hide_row"]').trigger("click");
    expect(mockSetArtistRowHidden).toHaveBeenCalledWith("albums", true);

    await wrapper.get('[aria-label="show_row"]').trigger("click");
    expect(mockSetArtistRowHidden).toHaveBeenCalledWith("bio", false);
  });

  it("clears both preferences from the reset button", async () => {
    const wrapper = mountEditor(["bio"]);

    await buttonWithText(wrapper, "reset_to_default")!.trigger("click");

    expect(mockResetArtistRows).toHaveBeenCalled();
  });

  it("closes on done", async () => {
    const wrapper = mountEditor(["bio"]);

    await buttonWithText(wrapper, "done")!.trigger("click");

    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("saves the source picked for a row", async () => {
    const wrapper = mountEditor(["albums"]);

    await wrapper.get('[data-source="spotify--1"]').trigger("click");

    expect(mockSetArtistRowSource).toHaveBeenCalledWith("albums", "spotify--1");
  });

  it("offers the library to a release row and every provider at once to an aggregated one", () => {
    const sources = (wrapper: VueWrapper) =>
      rows(wrapper).map((row) =>
        row
          .findAll("[data-source]")
          .map((item) => item.attributes("data-source")),
      );

    expect(sources(mountEditor(["albums", "top_tracks"]))).toEqual([
      ["library", "spotify--1"],
      ["all", "spotify--1"],
    ]);
  });

  it("offers no source at all for a provider artist", () => {
    const wrapper = mountEditor(
      ["albums", "top_tracks"],
      artist({
        provider: "spotify--1",
        provider_mappings: ARTIST.provider_mappings,
      }),
    );

    expect(wrapper.findAll("[data-source]")).toHaveLength(0);
  });

  it("toggles a row from the switch on a phone", async () => {
    mockIsPhoneSizedScreen.mockReturnValue(true);

    const wrapper = mountEditor(["bio"]);
    await wrapper.get('[role="switch"]').trigger("click");

    expect(mockSetArtistRowHidden).toHaveBeenCalledWith("bio", true);
  });
});
