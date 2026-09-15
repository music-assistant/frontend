import InfoHeader from "@/components/InfoHeader.vue";
import type { Scope, Track } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { track } from "../fixtures/track";

const { apiMock, authMock, storeMock, eventbusMock } = vi.hoisted(() => ({
  apiMock: {
    toggleFavorite: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    getGenresForMediaItem: vi.fn(() => Promise.resolve([])),
  },
  authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
  storeMock: { currentUser: undefined },
  eventbusMock: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: authMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: eventbusMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

// the context menu builder pulls in the whole action layer, unrelated to the
// header's own controls
vi.mock("@/layouts/default/ItemContextMenu.vue", () => ({
  getContextMenuItems: vi.fn(() => Promise.resolve([])),
}));

// heavy children the favorite control does not depend on
vi.mock("@/components/Toolbar.vue", () => ({
  default: { name: "Toolbar", template: "<div />" },
}));
vi.mock("@/components/MarkdownText.vue", () => ({
  default: { name: "MarkdownText", template: "<div />" },
}));
vi.mock("@/components/AudioAnalysisMetadata.vue", () => ({
  default: { name: "AudioAnalysisMetadata", template: "<div />" },
}));
vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: { name: "MediaItemThumb", template: "<div />" },
}));
vi.mock("@/components/MediaCollectionThumb.vue", () => ({
  default: { name: "MediaCollectionThumb", template: "<div />" },
}));
vi.mock("@/components/MarqueeText.vue", () => ({
  default: { name: "MarqueeText", template: "<div><slot /></div>" },
}));
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: { name: "ProviderIcon", template: "<div />" },
}));
vi.mock("@/components/MenuButton.vue", () => ({
  default: { name: "MenuButton", template: "<div />" },
}));

const vuetify = createVuetify({ components, directives });

function mountHeader(item: Track) {
  return mount(InfoHeader, {
    props: { item },
    global: {
      plugins: [vuetify],
      mocks: { $t: (key: string) => key },
    },
  });
}

describe("InfoHeader favorite toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.subscribe.mockReturnValue(() => {});
    apiMock.getGenresForMediaItem.mockResolvedValue([]);
    // a member may edit the library, so the favorite control is shown
    authMock.hasScope.mockReturnValue(true);
  });

  it("renders the favorite toggle as a labelled shadcn button", () => {
    const wrapper = mountHeader(track({ favorite: false }));

    const favBtn = wrapper.find('button[aria-label="tooltip.favorite"]');
    expect(favBtn.exists()).toBe(true);
    expect(favBtn.attributes("type")).toBe("button");
    expect(favBtn.attributes("aria-pressed")).toBe("false");
    // size-6 keeps the icon at 24px, defeating the Button base svg shrink
    expect(favBtn.find("svg").classes()).toContain("size-6");
  });

  it("reflects the favorite state through aria-pressed", () => {
    const wrapper = mountHeader(track({ favorite: true }));

    const favBtn = wrapper.find('button[aria-label="tooltip.favorite"]');
    expect(favBtn.attributes("aria-pressed")).toBe("true");
    expect(favBtn.find("svg").classes()).toContain("size-6");
  });

  it("toggles the favorite state on click", async () => {
    const item = track({ favorite: false });
    const wrapper = mountHeader(item);

    await wrapper
      .find('button[aria-label="tooltip.favorite"]')
      .trigger("click");
    expect(apiMock.toggleFavorite).toHaveBeenCalledTimes(1);
    expect(apiMock.toggleFavorite.mock.calls[0][0]).toMatchObject({
      item_id: item.item_id,
    });
  });

  it("no longer renders the old native favorite button", () => {
    const wrapper = mountHeader(track({ favorite: false }));

    expect(wrapper.find(".favorite-icon-button").exists()).toBe(false);
  });
});
