import ShowCard from "@/components/ai-radio/ShowCard.vue";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useShows } from "@/composables/ai-radio/useShows";
import type { MusicAssistantApi } from "@/plugins/api";
import { i18n } from "@/plugins/i18n";
import type {
  AIRadioSession,
  AIRadioStation,
  Scope,
} from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../fixtures/scopes";

const { hasScope } = vi.hoisted(() => ({
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { guestSessionKind: () => null, hasScope },
}));

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

describe("ShowCard editing rights", () => {
  // the stubs render their slots, so the menu entries show up as well
  const mountCard = () =>
    mount(ShowCard, {
      props: { show },
      shallow: true,
      global: { renderStubDefaultSlot: true },
    });

  it("lets an admin customize, duplicate and delete the show", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    const wrapper = mountCard();

    expect(wrapper.findAllComponents(DropdownMenuItem)).toHaveLength(3);
    expect(wrapper.attributes("role")).toBe("button");
    await wrapper.trigger("click");
    expect(wrapper.emitted("customize")).toEqual([[show.id]]);
  });

  it.each([
    ["a member", BUILTIN_ROLE_SCOPES.user],
    ["a guest", BUILTIN_ROLE_SCOPES.guest],
  ])("leaves %s only the play button", async (_role, scopes) => {
    hasScope.mockImplementation(scopeChecker(scopes));
    const wrapper = mountCard();

    expect(wrapper.findComponent(DropdownMenu).exists()).toBe(false);
    expect(wrapper.attributes("role")).toBeUndefined();
    await wrapper.trigger("click");
    expect(wrapper.emitted("customize")).toBeUndefined();
    expect(wrapper.find('[aria-label="Play"]').exists()).toBe(true);
  });
});
