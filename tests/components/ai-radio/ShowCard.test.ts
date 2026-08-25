import ShowCard from "@/components/ai-radio/ShowCard.vue";
import { useShows } from "@/composables/ai-radio/useShows";
import type { MusicAssistantApi } from "@/plugins/api";
import { i18n } from "@/plugins/i18n";
import type { AIRadioSession, AIRadioStation } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({
  default: {
    players: {},
    sendCommand: vi.fn(async () => []),
    getLibraryPlaylists: vi.fn<MusicAssistantApi["getLibraryPlaylists"]>(
      async () => [],
    ),
  },
}));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const show = {
  id: "party_host_pirates",
  name: "Party host — Pirates",
  source_playlist_id: "42",
  source_playlist_provider: "library",
} as AIRadioStation;

const session = (status: string): AIRadioSession =>
  ({
    session_id: "s1",
    station_id: show.id,
    mode: "dynamic",
    status,
    created_at: "2026-07-29T11:00:00Z",
    ended_at: status === "running" ? null : "2026-07-29T11:30:00Z",
  }) as unknown as AIRadioSession;

const renderCard = (locale: string, sessionStatus: string) => {
  const previous = i18n.global.locale.value;
  i18n.global.locale.value = locale;
  useShows().sessions.value = [session(sessionStatus)];
  try {
    return mount(ShowCard, { props: { show }, shallow: true });
  } finally {
    i18n.global.locale.value = previous;
  }
};

afterEach(() => {
  useShows().sessions.value = [];
});

describe("ShowCard status chip", () => {
  it("renders the last-on-air chip for a stopped show under an underscored locale", () => {
    const wrapper = renderCard("en_GB", "stopped");

    expect(wrapper.find(".show-card__status-chip").exists()).toBe(true);
    expect(wrapper.text()).toContain("Last on air");
  });

  it("renders the chip under a hyphenated locale", () => {
    const wrapper = renderCard("en-GB", "stopped");

    expect(wrapper.text()).toContain("Last on air");
  });

  it("renders no relative-time chip while the show is on air", () => {
    const wrapper = renderCard("en_GB", "running");

    expect(wrapper.find(".show-card__status-chip").exists()).toBe(false);
  });
});
