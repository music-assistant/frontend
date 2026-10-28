import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiCommandError,
  ConnectionLostError,
  ConnectionState,
} from "@/plugins/api";
import en from "@/translations/en.json";

const translate = (key: string): string =>
  key
    .split(".")
    .reduce<unknown>(
      (value, segment) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[segment]
          : undefined,
      en,
    ) as string;
import ArtistDetails from "./ArtistDetails.vue";
import GenreDetails from "./GenreDetails.vue";

const { apiMock, errorToast } = vi.hoisted(() => ({
  apiMock: {
    state: { value: "initialized" },
    providers: {},
    getGenre: vi.fn(),
    getLibraryGenres: vi.fn(),
    getGenreOverviewRows: vi.fn(),
    getGenreTracks: vi.fn(),
    getArtist: vi.fn(),
  },
  errorToast: vi.fn(),
}));

vi.mock("@/plugins/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/plugins/api")>();
  return { ...original, api: apiMock };
});
vi.mock("vue-sonner", () => ({ toast: { error: errorToast } }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: () => false } }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: { emit: vi.fn() } }));
vi.mock("@/composables/useDetailItemUpdates", () => ({
  useDetailItemUpdates: vi.fn(),
}));
vi.mock("@/composables/userPreferences", () => ({
  useUserPreferences: () => ({
    getPreference: () => ref("list"),
    setPreference: vi.fn(),
  }),
}));
vi.mock("@/composables/useArtistRowData", () => ({
  useArtistRowData: () => new Proxy({}, { get: () => ref([]) }),
}));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => translate(key),
}));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => translate(key) }),
}));
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

const stubs = {
  InfoHeader: {
    props: ["item"],
    template: '<div data-test="item">{{ item?.name }}</div>',
  },
  ArtistHero: {
    props: ["item"],
    template: '<div data-test="item">{{ item?.name }}</div>',
  },
  GenreAliasManager: {
    props: ["existingGenreNames"],
    template: '<div data-test="names">{{ existingGenreNames.size }}</div>',
  },
  ItemsListing: { template: '<div data-test="listing" />' },
  ProviderDetails: true,
  EditorialShelf: true,
  RowsEditor: true,
};

const genre = (id: string) => ({
  item_id: id,
  provider: "library",
  uri: `genre://library/${id}`,
  name: `Genre ${id}`,
});
const artist = (id: string) => ({
  item_id: id,
  provider: "library",
  uri: `artist://library/${id}`,
  name: `Artist ${id}`,
  provider_mappings: [],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
}
function busy(wrapper: ReturnType<typeof mount>) {
  return (wrapper.vm as unknown as { loading: boolean }).loading;
}

beforeEach(() => {
  vi.resetAllMocks();
  apiMock.state = ref(ConnectionState.INITIALIZED);
  apiMock.getLibraryGenres.mockResolvedValue([]);
  apiMock.getGenreOverviewRows.mockResolvedValue([]);
  apiMock.getGenreTracks.mockResolvedValue([]);
});

describe("GenreDetails requests", () => {
  const render = () =>
    mount(GenreDetails, {
      props: { itemId: "1", provider: "library" },
      global: { stubs, mocks: { $t: translate } },
    });

  it("releases loading after a failed genre read and retries only after reconnect", async () => {
    apiMock.getGenre.mockRejectedValueOnce(new Error("offline"));
    apiMock.getGenre.mockResolvedValue(genre("1"));
    const wrapper = render();
    await settle();
    expect(busy(wrapper)).toBe(false);
    expect(errorToast).toHaveBeenCalledWith(en.items_load_failed);
    expect(apiMock.getGenre).toHaveBeenCalledTimes(1);
    await settle();
    expect(apiMock.getGenre).toHaveBeenCalledTimes(1);
    apiMock.state.value = ConnectionState.RECONNECTING;
    await settle();
    apiMock.state.value = ConnectionState.INITIALIZED;
    await settle();
    expect(apiMock.getGenre).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[data-test="item"]').text()).toBe("Genre 1");
    wrapper.unmount();
  });

  it("recovers when mounted after reconnecting already began", async () => {
    apiMock.state.value = ConnectionState.RECONNECTING;
    apiMock.getGenre
      .mockRejectedValueOnce(new ConnectionLostError())
      .mockResolvedValue(genre("1"));
    const wrapper = render();
    await settle();
    expect(errorToast).not.toHaveBeenCalled();
    apiMock.state.value = ConnectionState.INITIALIZED;
    await settle();
    expect(apiMock.getGenre).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[data-test="item"]').text()).toBe("Genre 1");
    wrapper.unmount();
  });

  it("does not emit feedback from pending genre or names reads after unmount", async () => {
    const request = deferred<ReturnType<typeof genre>>();
    apiMock.getGenre.mockReturnValueOnce(request.promise);
    const wrapper = render();
    wrapper.unmount();
    request.reject(new Error("late genre failure"));
    await settle();
    expect(errorToast).not.toHaveBeenCalled();
    expect(apiMock.getLibraryGenres).not.toHaveBeenCalled();

    const namesRequest = deferred<ReturnType<typeof genre>[]>();
    apiMock.getGenre.mockResolvedValueOnce(genre("2"));
    apiMock.getLibraryGenres.mockReturnValueOnce(namesRequest.promise);
    const second = render();
    await settle();
    second.unmount();
    namesRequest.reject(new Error("late names failure"));
    await settle();
    expect(errorToast).not.toHaveBeenCalled();
  });

  it("does not report late discovery-row or fallback failures after unmount", async () => {
    const rowsRequest = deferred<never[]>();
    apiMock.getGenre.mockResolvedValue(genre("1"));
    apiMock.getGenreOverviewRows.mockReturnValueOnce(rowsRequest.promise);
    const wrapper = render();
    await settle();
    wrapper.unmount();
    rowsRequest.reject(new Error("late rows failure"));
    await settle();
    expect(apiMock.getGenreTracks).not.toHaveBeenCalled();
    expect(errorToast).not.toHaveBeenCalled();

    const tracksRequest = deferred<never[]>();
    apiMock.getGenreTracks.mockReturnValueOnce(tracksRequest.promise);
    const second = render();
    await settle();
    second.unmount();
    tracksRequest.reject(new Error("late tracks failure"));
    await settle();
    expect(errorToast).not.toHaveBeenCalled();
  });

  it("keeps the loaded genre usable if its names read fails", async () => {
    apiMock.getGenre.mockResolvedValue(genre("1"));
    apiMock.getLibraryGenres.mockRejectedValue(new Error("offline"));
    const wrapper = render();
    await settle();
    expect(busy(wrapper)).toBe(false);
    expect(wrapper.find('[data-test="item"]').text()).toBe("Genre 1");
    expect(wrapper.findAll('[data-test="listing"]').length).toBeGreaterThan(0);
    expect(errorToast).toHaveBeenCalledWith(en.settings.error_loading_genres);
    wrapper.unmount();
  });

  it("ignores an older response and cannot let it release newer loading", async () => {
    const oldRequest = deferred<ReturnType<typeof genre>>();
    const newRequest = deferred<ReturnType<typeof genre>>();
    apiMock.getGenre
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const wrapper = render();
    await wrapper.setProps({ itemId: "2" });
    oldRequest.resolve(genre("1"));
    await settle();
    expect(busy(wrapper)).toBe(true);
    expect(wrapper.find('[data-test="item"]').text()).toBe("");
    newRequest.resolve(genre("2"));
    await settle();
    expect(busy(wrapper)).toBe(false);
    expect(wrapper.find('[data-test="item"]').text()).toBe("Genre 2");
    wrapper.unmount();
  });
});

describe("ArtistDetails requests", () => {
  const render = () =>
    mount(ArtistDetails, {
      props: { itemId: "1", provider: "library" },
      global: { stubs, mocks: { $t: translate } },
    });

  it("releases loading on failure and retries the current artist after reconnect", async () => {
    apiMock.getArtist.mockRejectedValueOnce(new Error("offline"));
    apiMock.getArtist.mockResolvedValue(artist("1"));
    const wrapper = render();
    await settle();
    expect(busy(wrapper)).toBe(false);
    expect(errorToast).toHaveBeenCalledWith(en.items_load_failed);
    expect(apiMock.getArtist).toHaveBeenCalledTimes(1);
    apiMock.state.value = ConnectionState.RECONNECTING;
    await settle();
    apiMock.state.value = ConnectionState.INITIALIZED;
    await settle();
    expect(apiMock.getArtist).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[data-test="item"]').text()).toBe("Artist 1");
    wrapper.unmount();
  });

  it("recovers when mounted during authentication without showing connection-loss feedback", async () => {
    apiMock.state.value = ConnectionState.AUTHENTICATING;
    apiMock.getArtist
      .mockRejectedValueOnce(new ConnectionLostError())
      .mockResolvedValue(artist("1"));
    const wrapper = render();
    await settle();
    expect(errorToast).not.toHaveBeenCalled();
    apiMock.state.value = ConnectionState.INITIALIZED;
    await settle();
    expect(apiMock.getArtist).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[data-test="item"]').text()).toBe("Artist 1");
    wrapper.unmount();
  });

  it("does not show a second toast for server errors", async () => {
    apiMock.getArtist.mockRejectedValue(
      new ApiCommandError("Server rejected", 6),
    );
    const wrapper = render();
    await settle();
    expect(busy(wrapper)).toBe(false);
    expect(errorToast).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("does not show feedback after a pending read rejects on unmount", async () => {
    const request = deferred<ReturnType<typeof artist>>();
    apiMock.getArtist.mockReturnValueOnce(request.promise);
    const wrapper = render();
    wrapper.unmount();
    request.reject(new Error("late artist failure"));
    await settle();
    expect(errorToast).not.toHaveBeenCalled();
  });

  it("does not retry an unrelated error or an old artist after changing route", async () => {
    apiMock.getArtist
      .mockResolvedValueOnce(artist("1"))
      .mockRejectedValueOnce(new Error("offline"));
    const wrapper = render();
    await settle();
    apiMock.state.value = ConnectionState.RECONNECTING;
    await settle();
    apiMock.state.value = ConnectionState.INITIALIZED;
    await settle();
    expect(apiMock.getArtist).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ itemId: "2" });
    await settle();
    await wrapper.setProps({ itemId: "3" });
    apiMock.state.value = ConnectionState.RECONNECTING;
    await settle();
    apiMock.state.value = ConnectionState.INITIALIZED;
    await settle();
    expect(apiMock.getArtist).toHaveBeenCalledTimes(3);
    wrapper.unmount();
  });

  it("retries a read that fails after reconnect without clearing the selected artist", async () => {
    const first = deferred<ReturnType<typeof artist>>();
    const retry = deferred<ReturnType<typeof artist>>();
    apiMock.getArtist
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(retry.promise);
    const wrapper = render();
    apiMock.state.value = ConnectionState.RECONNECTING;
    await settle();
    apiMock.state.value = ConnectionState.INITIALIZED;
    await settle();
    first.reject(new Error("offline"));
    await settle();
    expect(apiMock.getArtist).toHaveBeenCalledTimes(2);
    retry.resolve(artist("1"));
    await settle();
    expect(wrapper.find('[data-test="item"]').text()).toBe("Artist 1");
    wrapper.unmount();
  });

  it("ignores an old response while a newer artist is loading", async () => {
    const oldRequest = deferred<ReturnType<typeof artist>>();
    const newRequest = deferred<ReturnType<typeof artist>>();
    apiMock.getArtist
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const wrapper = render();
    await wrapper.setProps({ itemId: "2" });
    oldRequest.resolve(artist("1"));
    await settle();
    expect(busy(wrapper)).toBe(true);
    expect(wrapper.find('[data-test="item"]').text()).toBe("");
    newRequest.resolve(artist("2"));
    await settle();
    expect(busy(wrapper)).toBe(false);
    expect(wrapper.find('[data-test="item"]').text()).toBe("Artist 2");
    wrapper.unmount();
  });
});
