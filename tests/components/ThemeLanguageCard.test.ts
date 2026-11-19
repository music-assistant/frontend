import ThemeLanguageCard from "@/components/profile/ThemeLanguageCard.vue";
import { store } from "@/plugins/store";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../fixtures/user";

const { setUserPreferences, toastMock } = vi.hoisted(() => ({
  setUserPreferences: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return { store: reactive({ currentUser: undefined }) };
});
vi.mock("@/plugins/auth", () => ({
  authManager: { isGuestAccessSession: () => false },
}));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  i18n: { global: { availableLocales: ["en", "nl"] } },
}));
vi.mock("@/composables/userPreferences", () => ({ setUserPreferences }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

// the select opens in a popper, so a plain stand-in shows its options
const SelectStub = {
  name: "Select",
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: "<div><slot /></div>",
};
const SelectItemStub = {
  props: ["value"],
  template: '<div data-testid="language-option" :data-value="value" />',
};
const passthrough = { template: "<div><slot /></div>" };

enableAutoUnmount(afterEach);

function mountCard() {
  return mount(ThemeLanguageCard, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Select: SelectStub,
        SelectTrigger: passthrough,
        SelectValue: true,
        SelectContent: passthrough,
        SelectItem: SelectItemStub,
        Spinner: true,
      },
    },
  });
}

// what is checked shows on the radio itself
function checkedTheme(wrapper: ReturnType<typeof mountCard>) {
  return wrapper
    .findAll('[role="radio"]')
    .find((radio) => radio.attributes("aria-checked") === "true")
    ?.attributes("value");
}

describe("ThemeLanguageCard", () => {
  let reload: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    store.currentUser = user({
      preferences: { theme: "dark", language: "nl" },
    });
    // the account takes the change as it is written, the way the real write does
    setUserPreferences.mockImplementation(
      async (values: Record<string, unknown>) => {
        store.currentUser!.preferences = {
          ...store.currentUser!.preferences,
          ...values,
        };
        return true;
      },
    );
    reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
  });

  afterEach(() => {
    reload.mockRestore();
  });

  it("shows the theme and the language of the account", () => {
    const wrapper = mountCard();

    expect(checkedTheme(wrapper)).toBe("dark");
    expect(wrapper.getComponent(SelectStub).props("modelValue")).toBe("nl");
  });

  it("offers the automatic theme and language besides every one there is", () => {
    const wrapper = mountCard();

    expect(
      wrapper
        .findAll('[role="radio"]')
        .map((radio) => radio.attributes("value")),
    ).toEqual(["auto", "light", "dark"]);
    expect(
      wrapper
        .findAll('[data-testid="language-option"]')
        .map((option) => option.attributes("data-value")),
    ).toEqual(["auto", "en", "nl"]);
  });

  it("saves a theme to the account as soon as it is picked", async () => {
    const wrapper = mountCard();

    await wrapper.get('[role="radio"][value="light"]').trigger("click");
    await flushPromises();

    expect(setUserPreferences).toHaveBeenCalledWith(
      { theme: "light" },
      { suppressGlobalError: true },
    );
    expect(checkedTheme(wrapper)).toBe("light");
    expect(toastMock.success).toHaveBeenCalledWith("settings.settings_saved");
    // the app shows the theme as the preference changes, without a reload
    expect(reload).not.toHaveBeenCalled();
  });

  it("says so when the account does not take the theme", async () => {
    setUserPreferences.mockResolvedValue(false);
    const wrapper = mountCard();

    await wrapper.get('[role="radio"][value="light"]').trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("settings.save_failed");
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(checkedTheme(wrapper)).toBe("dark");
  });

  it("saves a language to the account and reloads the app to show it", async () => {
    const wrapper = mountCard();

    wrapper.getComponent(SelectStub).vm.$emit("update:modelValue", "en");
    await flushPromises();

    expect(setUserPreferences).toHaveBeenCalledWith(
      { language: "en" },
      { suppressGlobalError: true },
    );
    expect(reload).toHaveBeenCalledOnce();
    // the overlay stays up until the app has reloaded
    expect(wrapper.find('[data-testid="loading-overlay"]').exists()).toBe(true);
  });

  it("stays as it is when the account does not take the language", async () => {
    setUserPreferences.mockResolvedValue(false);
    const wrapper = mountCard();

    wrapper.getComponent(SelectStub).vm.$emit("update:modelValue", "en");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("settings.save_failed");
    expect(reload).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="loading-overlay"]').exists()).toBe(
      false,
    );
  });

  it("writes nothing when what is picked was already chosen", async () => {
    const wrapper = mountCard();

    wrapper.getComponent(SelectStub).vm.$emit("update:modelValue", "nl");
    await wrapper.get('[role="radio"][value="dark"]').trigger("click");
    await flushPromises();

    expect(setUserPreferences).not.toHaveBeenCalled();
  });

  it("falls back to the automatic theme and language on an account without them", () => {
    store.currentUser = user();
    const wrapper = mountCard();

    expect(checkedTheme(wrapper)).toBe("auto");
    expect(wrapper.getComponent(SelectStub).props("modelValue")).toBe("auto");
  });
});
