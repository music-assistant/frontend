import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FrontendConfig from "@/views/settings/FrontendConfig.vue";

const { apiMock, routerMock, storeMock, setPreference } = vi.hoisted(() => ({
  apiMock: { players: {}, providers: {} },
  routerMock: { push: vi.fn(() => Promise.resolve()) },
  storeMock: {
    isIngressSession: false,
    currentUser: {
      user_id: "user",
      preferences: {} as Record<string, unknown>,
    },
  },
  setPreference: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  i18n: { global: { availableLocales: ["en", "nl"] } },
}));
vi.mock("vue-router", () => ({ useRouter: () => routerMock }));
vi.mock("@/composables/userPreferences", () => ({
  useUserPreferences: () => ({ setPreference }),
}));

const createLocalStorageMock = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  } as Storage;
};

// the page builds its entries on mount, so a leaked instance would answer the
// next test's submit alongside the fresh one
enableAutoUnmount(afterEach);

type ConfiguredPage = Awaited<ReturnType<typeof mountPage>>;

// the entries are built in onMounted, and the form is behind a v-if on them
async function mountPage() {
  const wrapper = mount(FrontendConfig, {
    global: {
      stubs: {
        SettingsHeaderCard: true,
        Spinner: true,
        EditConfig: { name: "EditConfig", template: "<div />" },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

/** Submits every entry, the way EditConfig's getCurrentValues does. */
async function submitAll(
  wrapper: ConfiguredPage,
  overrides: Record<string, unknown> = {},
) {
  const entries = (
    wrapper.vm as unknown as { config: { key: string; value: unknown }[] }
  ).config;
  const values = Object.fromEntries(entries.map((e) => [e.key, e.value]));
  wrapper
    .findComponent({ name: "EditConfig" })
    .vm.$emit("submit", { ...values, ...overrides });
  await flushPromises();
}

describe("FrontendConfig save", () => {
  let reload: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.currentUser.preferences = {};
    vi.stubGlobal("localStorage", createLocalStorageMock());
    reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    reload.mockRestore();
  });

  it("does not reload the page when a save changes nothing", async () => {
    const wrapper = await mountPage();
    await submitAll(wrapper);

    // every preference is still written; only the reload is conditional
    expect(setPreference).toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads the page when a per-user preference actually changes", async () => {
    const wrapper = await mountPage();
    await submitAll(wrapper, { theme: "dark" });

    expect(setPreference).toHaveBeenCalledWith("theme", "dark");
    expect(reload).toHaveBeenCalled();
  });
});
