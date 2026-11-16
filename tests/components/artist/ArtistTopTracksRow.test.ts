/**
 * A top track the server knows only by an external id has no provider
 * mappings yet: it keeps its play button, since the server looks it up when it
 * is played, and is muted like a discography release.
 */
import ArtistTopTracksRow from "@/components/artist/ArtistTopTracksRow.vue";
import type { Track } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { artist } from "../../fixtures/artist";
import { track } from "../../fixtures/track";

vi.mock("@/plugins/api", () => {
  const api = { providers: {} };
  return { api, default: api };
});

vi.mock("@/plugins/store", () => ({ store: {} }));

vi.mock("@/helpers/media_item_actions", () => ({
  handleMediaItemClick: vi.fn(),
  handleMenuBtnClick: vi.fn(),
  handlePlayBtnClick: vi.fn(),
}));

vi.mock("@/plugins/breakpoint", () => ({ isPhoneSizedScreen: () => false }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const topTrack = track({
  item_id: "musicbrainz_recordingid:rec-1",
  provider: "external",
  provider_mappings: [],
  name: "Hallelujah",
});
// a track whose music service is gone
const unavailableTrack = track({ item_id: "2", provider: "spotify" });

function mountRow(tracks: Track[]) {
  return mount(ArtistTopTracksRow, {
    props: { artist: artist(), tracks },
    global: {
      directives: { hold: () => undefined },
      mocks: { $t: (key: string) => key },
      stubs: {
        RouterLink: true,
        DetailSectionTitle: true,
        MediaItemThumb: {
          name: "MediaItemThumb",
          props: ["item"],
          template: "<img />",
        },
        RowPlayButton: {
          name: "RowPlayButton",
          props: ["label"],
          template: "<button />",
        },
      },
    },
  });
}

describe("ArtistTopTracksRow for a track that is not in the library", () => {
  it("offers its play button", () => {
    const wrapper = mountRow([topTrack, unavailableTrack]);
    const labels = wrapper
      .findAllComponents({ name: "RowPlayButton" })
      .map((button) => button.props("label"));

    expect(labels).toContain("play Hallelujah");
    expect(labels).not.toContain("play Track");
  });

  it("mutes its artwork", () => {
    const wrapper = mountRow([topTrack, unavailableTrack]);
    const [externalThumb, otherThumb] = wrapper.findAllComponents({
      name: "MediaItemThumb",
    });

    expect(externalThumb.classes()).toEqual(
      expect.arrayContaining(["opacity-55", "grayscale"]),
    );
    expect(otherThumb.classes()).not.toContain("grayscale");
  });
});
