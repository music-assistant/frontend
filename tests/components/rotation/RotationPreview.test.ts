import RotationPreview from "@/components/rotation/RotationPreview.vue";
import type { RotationPreview as RotationPreviewData } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

enableAutoUnmount(afterEach);

const PREVIEW = {
  groups: [
    {
      item: { name: "Böser die Glocken nie klingen", uri: "library://album/1" },
      tracks: [
        {
          track: { name: "Böser die Glocken nie klingen (Inhaltsangabe)" },
          removed: true,
        },
        {
          track: { name: "Böser die Glocken nie klingen (Titelmusik)" },
          removed: false,
        },
      ],
    },
    {
      item: { name: "Tag 01 - Unbekannter Herkunft", uri: "library://album/2" },
      tracks: [
        {
          track: { name: "Tag 01 - Unbekannter Herkunft (Teil 01)" },
          removed: false,
        },
        {
          track: { name: "Tag 01 - Unbekannter Herkunft (Teil 02)" },
          removed: false,
        },
      ],
    },
  ],
  step_counts: [],
  total_tracks: 40,
  total_exact: true,
  duration_seconds: 3725,
} as unknown as RotationPreviewData;

function mountPreview(props: Record<string, unknown> = {}) {
  return mount(RotationPreview, {
    props: {
      preview: PREVIEW,
      loading: false,
      includeRemoved: true,
      limit: 20,
      ...props,
    },
    global: { stubs: { MediaItemThumb: true } },
  });
}

describe("RotationPreview", () => {
  it("renders the groups and track titles in order", () => {
    const text = mountPreview().text();
    const order = [
      "Böser die Glocken nie klingen (Titelmusik)",
      "Tag 01 - Unbekannter Herkunft (Teil 01)",
      "Tag 01 - Unbekannter Herkunft (Teil 02)",
    ].map((title) => text.indexOf(title));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(text).toContain("first 3 of 40 tracks");
    expect(text).toContain("1:02:05");
  });

  it("crosses out removed rows only when they are included", () => {
    const shown = mountPreview({ includeRemoved: true });
    expect(shown.text()).toContain("(Inhaltsangabe)");
    expect(shown.findAll(".line-through")).toHaveLength(1);

    const hidden = mountPreview({ includeRemoved: false });
    expect(hidden.text()).not.toContain("(Inhaltsangabe)");
    expect(hidden.findAll(".line-through")).toHaveLength(0);
  });

  it("says at least when the total is not exact", () => {
    const wrapper = mountPreview({
      preview: { ...PREVIEW, total_exact: false },
    });
    expect(wrapper.text()).toContain("at least 40");
  });

  it("emits more from Show more and hides it at the maximum limit", async () => {
    const wrapper = mountPreview();
    const button = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Show more"));
    expect(button).toBeDefined();
    await button!.trigger("click");
    expect(wrapper.emitted("more")).toHaveLength(1);

    const maxed = mountPreview({ limit: 200 });
    expect(maxed.text()).not.toContain("Show more");
  });

  it("emits reshuffle and shows the empty state without groups", async () => {
    const wrapper = mountPreview({
      preview: { ...PREVIEW, groups: [], total_tracks: 0 },
    });
    expect(wrapper.text()).toContain("Nothing to preview yet");
    const shuffle = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Shuffle preview"));
    await shuffle!.trigger("click");
    expect(wrapper.emitted("reshuffle")).toHaveLength(1);
  });

  it("lists a flat track preview once, without a header per track", () => {
    const tracks = [
      "Tag 01 - Unbekannter Herkunft (Teil 01)",
      "Tag 01 - Unbekannter Herkunft (Teil 02)",
    ].map((name, i) => {
      const track = { name, uri: `library://track/${i}`, media_type: "track" };
      return { item: track, tracks: [{ track, removed: false }] };
    });
    const wrapper = mountPreview({
      preview: { ...PREVIEW, groups: tracks, total_tracks: 2 },
    });
    const text = wrapper.text();
    for (const name of [
      "Tag 01 - Unbekannter Herkunft (Teil 01)",
      "Tag 01 - Unbekannter Herkunft (Teil 02)",
    ]) {
      expect(text.split(name)).toHaveLength(2);
    }
    expect(wrapper.findAll("ol")).toHaveLength(1);
    expect(wrapper.findAll("li")).toHaveLength(2);
    expect(wrapper.findAll("li media-item-thumb-stub")).toHaveLength(2);
    const rows = wrapper.findAll("li").map((li) => li.text().trim());
    expect(rows[0]).toMatch(/^1\D/);
    expect(rows[1]).toMatch(/^2\D/);
  });

  it("shows the version of an album and a track, as the other lists do", () => {
    const album = {
      name: "Homework",
      version: "25th Anniversary Edition",
      uri: "library://album/2896",
      media_type: "album",
    };
    const wrapper = mountPreview({
      preview: {
        ...PREVIEW,
        groups: [
          {
            item: album,
            tracks: [
              { track: { name: "Burnin'", version: "" }, removed: false },
              {
                track: { name: "Burnin'", version: "Slam Mix" },
                removed: false,
              },
            ],
          },
        ],
        total_tracks: 2,
      },
    });
    expect(wrapper.text()).toContain("Homework (25th Anniversary Edition)");
    const rows = wrapper.findAll("li").map((li) => li.text().trim());
    expect(rows[0]).toMatch(/Burnin'$/);
    expect(rows[1]).toMatch(/Burnin' \(Slam Mix\)$/);
  });

  it("shows the artists of an album under its name", () => {
    const album = {
      name: "Stay Hungry",
      uri: "library://album/7",
      media_type: "album",
      artists: [{ name: "Twisted Sister" }],
    };
    const wrapper = mountPreview({
      preview: {
        ...PREVIEW,
        groups: [
          {
            item: album,
            tracks: [{ track: { name: "Stay Hungry" }, removed: false }],
          },
        ],
        total_tracks: 1,
      },
    });
    const artist = wrapper.find('[data-testid="rotation-preview-artists"]');
    expect(artist.exists()).toBe(true);
    expect(artist.text()).toBe("Twisted Sister");
  });

  it("shows a track's artists only where they add something", () => {
    const sister = [{ name: "Twisted Sister" }];
    const album = {
      name: "Stay Hungry",
      uri: "library://album/7",
      media_type: "album",
      artists: sister,
    };
    const single = {
      name: "Ya Viene el Sol",
      uri: "library://track/9",
      media_type: "track",
      artists: [{ name: "Mecano" }],
    };
    const wrapper = mountPreview({
      preview: {
        ...PREVIEW,
        groups: [
          {
            item: album,
            tracks: [
              {
                track: { name: "Stay Hungry", artists: sister },
                removed: false,
              },
              {
                track: { name: "Guest", artists: [{ name: "Alice Cooper" }] },
                removed: false,
              },
            ],
          },
          { item: single, tracks: [{ track: single, removed: false }] },
        ],
        total_tracks: 3,
      },
    });
    const artists = wrapper
      .findAll('[data-testid="rotation-preview-track-artists"]')
      .map((el) => el.text());
    expect(artists).toEqual(["Alice Cooper", "Mecano"]);
  });

  it("shows every track's artists on a Various Artists album", () => {
    const wrapper = mountPreview({
      preview: {
        ...PREVIEW,
        groups: [
          {
            item: {
              name: "This Is The Sound Of Dubstep",
              uri: "library://album/3",
              media_type: "album",
              artists: [{ name: "Various Artists" }],
            },
            tracks: [
              {
                track: {
                  name: "In for the Kill",
                  artists: [{ name: "La Roux" }],
                },
                removed: false,
              },
              {
                track: { name: "Promises", artists: [{ name: "Nero" }] },
                removed: false,
              },
            ],
          },
        ],
        total_tracks: 2,
      },
    });
    const artists = wrapper
      .findAll('[data-testid="rotation-preview-track-artists"]')
      .map((el) => el.text());
    expect(artists).toEqual(["La Roux", "Nero"]);
  });

  it("shows each track's duration like a playlist row", () => {
    const wrapper = mountPreview({
      preview: {
        ...PREVIEW,
        groups: [
          {
            item: { name: "Stay Hungry", uri: "library://album/7" },
            tracks: [
              { track: { name: "Stay Hungry", duration: 184 }, removed: false },
            ],
          },
        ],
        total_tracks: 1,
      },
    });
    const duration = wrapper.find('[data-testid="rotation-preview-duration"]');
    expect(duration.text()).toBe("03:04");
  });

  it("asks to fix the marked steps when the steps have errors", () => {
    const wrapper = mountPreview({ preview: null, hasErrors: true });
    expect(wrapper.text()).toContain("Fix the marked steps to see a preview");
    expect(wrapper.text()).not.toContain("Add a step");
  });

  it("names a single track in the header", () => {
    const wrapper = mountPreview({ preview: { ...PREVIEW, total_tracks: 1 } });
    expect(wrapper.text()).toContain("of 1 track ·");
  });
});
