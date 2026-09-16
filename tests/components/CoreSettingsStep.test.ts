import CoreSettingsStep from "@/components/onboarding/steps/CoreSettingsStep.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  ConfigEntryType,
  Scope,
  type ConfigEntry,
  type CoreConfig,
  type ServerInfoMessage,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref, type Ref } from "vue";

const { apiMock, authMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    getStreamServerInfo: vi.fn<MusicAssistantApi["getStreamServerInfo"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
    // replaced with a real ref by the api mock factory below, so the step
    // follows a server info update the way it follows the real one
    serverInfo: { value: undefined } as Ref<ServerInfoMessage | undefined>,
  },
  authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  apiMock.serverInfo = ref<ServerInfoMessage | undefined>(undefined);
  return { api: apiMock, default: apiMock };
});

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: toastMock }));

enableAutoUnmount(afterEach);

let warnSpy: ReturnType<typeof vi.spyOn>;

const SERVER_ID = "server-1";
const INTERNAL_URL = "http://192.168.1.10:8095";
const STREAM_URL = "http://192.168.1.10:8097";
const MOVED_STREAM_URL = "http://10.0.0.5:8097";

/** What the user typed, as the form hands it over. */
const EDITED_VALUES = { server_name: "Living room" };

// the edits the form is holding on to, and whether they validate: a form that
// does not hand its values over is one showing the user what is wrong with them
const hasUnsavedChanges = ref(false);
const valuesValidate = ref(true);

// the form guards its pending edits again when a save does not land
const saveFailed = vi.fn();
// and takes the values that were saved over as its baseline when one does, so
// they stop counting as unsaved
const saveSucceeded = vi.fn((_values: Record<string, unknown>) => {
  hasUnsavedChanges.value = false;
});

/**
 * The form is covered where it lives; here it only has to be reachable, and to
 * answer the step the way the real one does.
 */
const editConfigStub = {
  name: "EditConfig",
  props: ["configEntries", "disabled", "showAdvancedSettings"],
  emits: ["submit"],
  setup(
    _props: unknown,
    { emit }: { emit: (event: "submit", values: typeof EDITED_VALUES) => void },
  ) {
    return {
      hasUnsavedChanges,
      saveFailed,
      saveSucceeded,
      submit: async () => {
        if (valuesValidate.value) emit("submit", EDITED_VALUES);
      },
    };
  },
  template: "<div />",
};

function serverInfo(
  overrides: Partial<ServerInfoMessage> = {},
): ServerInfoMessage {
  return {
    server_id: SERVER_ID,
    internal_url: INTERNAL_URL,
    external_url: null,
    has_remote_access: false,
    ...overrides,
  } as ServerInfoMessage;
}

function entry(key: string, overrides: Partial<ConfigEntry> = {}): ConfigEntry {
  return {
    category: "generic",
    default_value: null,
    key,
    label: key,
    options: [],
    required: false,
    type: ConfigEntryType.STRING,
    value: `${key} value`,
    ...overrides,
  };
}

/** The webserver configuration, with more in it than this step is about. */
function webserverConfig(values?: Record<string, ConfigEntry>): CoreConfig {
  return {
    domain: "webserver",
    last_error: null,
    values: values ?? {
      bind_port: entry("bind_port"),
      // in another order than the step asks for them, and one of them advanced
      external_url: entry("external_url", { advanced: true }),
      server_name: entry("server_name"),
      base_url: entry("base_url"),
    },
  };
}

/** The stream server configuration, likewise. */
function streamsConfig(values?: Record<string, ConfigEntry>): CoreConfig {
  return {
    domain: "streams",
    last_error: null,
    values: values ?? {
      bind_port: entry("bind_port"),
      publish_ip: entry("publish_ip", { advanced: true }),
    },
  };
}

/** A fetch answering every probe as this server. */
function answeringAsThisServer() {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ server_id: SERVER_ID }), { status: 200 }),
  );
}

/** The scopes this admin holds; everything, unless a test takes one away. */
function grantAllBut(...withheld: Scope[]) {
  authMock.hasScope.mockImplementation((scope) => !withheld.includes(scope));
}

function mountStep() {
  return mount(CoreSettingsStep, {
    global: {
      // the card is covered where it lives; here it only has to be reachable
      stubs: { EditConfig: editConfigStub, RemoteAccessCard: true },
    },
  });
}

async function mountLoadedStep() {
  const wrapper = mountStep();
  await flushPromises();
  return wrapper;
}

type Wrapper = ReturnType<typeof mountStep>;

function form(wrapper: Wrapper) {
  return wrapper.findComponent({ name: "EditConfig" });
}

function addressRow(wrapper: Wrapper, id: "internal" | "stream") {
  return wrapper.find(`[data-testid=onboarding-address-${id}]`);
}

function addressUrl(wrapper: Wrapper, id: "internal" | "stream") {
  return addressRow(wrapper, id).find("[data-testid=onboarding-address-url]");
}

function addressCheck(wrapper: Wrapper, id: "internal" | "stream") {
  return addressRow(wrapper, id).find("[data-testid=onboarding-address-check]");
}

function unreachableHint(wrapper: Wrapper) {
  return wrapper.find("[data-testid=onboarding-address-unreachable-hint]");
}

function advancedSection(wrapper: Wrapper) {
  return wrapper.find("[data-testid=onboarding-advanced-section]");
}

/** Whether the advanced settings are folded away, as `v-show` folds them. */
function advancedFolded(wrapper: Wrapper): boolean {
  return (
    advancedSection(wrapper).attributes("style")?.includes("display: none") ??
    false
  );
}

function probedUrls(): string[] {
  return (fetch as ReturnType<typeof vi.fn>).mock.calls.map(
    ([url]: unknown[]) => String(url),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  hasUnsavedChanges.value = false;
  valuesValidate.value = true;
  grantAllBut();
  apiMock.serverInfo.value = serverInfo();
  apiMock.getCoreConfig.mockImplementation(async (domain) =>
    domain === "webserver" ? webserverConfig() : streamsConfig(),
  );
  apiMock.saveCoreConfig.mockResolvedValue(webserverConfig());
  apiMock.getStreamServerInfo.mockResolvedValue({ base_url: STREAM_URL });
  vi.stubGlobal("fetch", answeringAsThisServer());
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  warnSpy.mockRestore();
});

describe("CoreSettingsStep", () => {
  describe("the addresses in use", () => {
    it("shows the addresses the server is using right now", async () => {
      const wrapper = await mountLoadedStep();

      expect(addressUrl(wrapper, "internal").text()).toBe(INTERNAL_URL);
      expect(addressUrl(wrapper, "stream").text()).toBe(STREAM_URL);
      expect(apiMock.getStreamServerInfo).toHaveBeenCalledOnce();
      // best effort: a row saying so is enough, not an error on top
      expect(apiMock.getStreamServerInfo).toHaveBeenCalledWith({
        suppressGlobalError: true,
      });
    });

    it("shows no stream server address until the server has answered", async () => {
      apiMock.getStreamServerInfo.mockImplementation(
        () => new Promise(() => {}),
      );

      const wrapper = await mountLoadedStep();

      // an address still being asked for is not one that is missing
      const row = addressRow(wrapper, "stream");
      expect(addressUrl(wrapper, "stream").exists()).toBe(false);
      expect(
        row.find("[data-testid=onboarding-address-unknown]").exists(),
      ).toBe(false);
      expect(addressCheck(wrapper, "stream").exists()).toBe(false);
    });

    it("says so when the stream server address is not available", async () => {
      apiMock.getStreamServerInfo.mockRejectedValue(new Error("boom"));

      const wrapper = await mountLoadedStep();

      // the row shows no address it cannot stand behind, and nothing is
      // checked that is not there
      const row = addressRow(wrapper, "stream");
      expect(addressUrl(wrapper, "stream").exists()).toBe(false);
      expect(
        row.find("[data-testid=onboarding-address-unknown]").exists(),
      ).toBe(true);
      expect(addressCheck(wrapper, "stream").exists()).toBe(false);
      expect(probedUrls()).toEqual([`${INTERNAL_URL}/info`]);
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("does not ask for the stream server address without leave to read settings", async () => {
      grantAllBut(Scope.CONFIG_CORE_READ);

      const wrapper = await mountLoadedStep();

      expect(apiMock.getStreamServerInfo).not.toHaveBeenCalled();
      expect(
        addressRow(wrapper, "stream")
          .find("[data-testid=onboarding-address-unknown]")
          .exists(),
      ).toBe(true);
    });

    it("checks each address from this browser", async () => {
      const wrapper = await mountLoadedStep();

      expect(probedUrls()).toEqual([
        `${INTERNAL_URL}/info`,
        `${STREAM_URL}/info`,
      ]);
      expect(addressCheck(wrapper, "internal").attributes("data-check")).toBe(
        "reachable",
      );
      expect(addressCheck(wrapper, "stream").attributes("data-check")).toBe(
        "reachable",
      );
      expect(unreachableHint(wrapper).exists()).toBe(false);
    });

    it("flags an address this browser could not reach, with one word of advice", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new TypeError("Failed to fetch");
        }),
      );

      const wrapper = await mountLoadedStep();

      expect(addressCheck(wrapper, "internal").attributes("data-check")).toBe(
        "unreachable",
      );
      expect(addressCheck(wrapper, "stream").attributes("data-check")).toBe(
        "unreachable",
      );
      // the advice is the same for both, so it is given once
      expect(
        wrapper.findAll("[data-testid=onboarding-address-unreachable-hint]"),
      ).toHaveLength(1);
    });

    it("says when an address could not be checked from this page", async () => {
      // an https page may not fetch a plain http address: nothing is known
      vi.stubGlobal("location", { protocol: "https:" });

      const wrapper = await mountLoadedStep();

      expect(addressCheck(wrapper, "internal").attributes("data-check")).toBe(
        "unchecked",
      );
      expect(probedUrls()).toEqual([]);
      expect(unreachableHint(wrapper).exists()).toBe(false);
    });

    it("checks the internal address again once the server advertises another", async () => {
      const wrapper = await mountLoadedStep();

      // the server pushes fresh server info after its settings changed
      apiMock.serverInfo.value = serverInfo({
        internal_url: "http://10.0.0.5:8095",
      });
      await flushPromises();

      expect(addressUrl(wrapper, "internal").text()).toBe(
        "http://10.0.0.5:8095",
      );
      expect(probedUrls()).toContain("http://10.0.0.5:8095/info");
      expect(addressCheck(wrapper, "internal").attributes("data-check")).toBe(
        "reachable",
      );
    });
  });

  describe("reaching the server from outside", () => {
    it("offers Music Assistant's own remote access to whoever may switch it", async () => {
      const wrapper = await mountLoadedStep();

      expect(wrapper.findComponent({ name: "RemoteAccessCard" }).exists()).toBe(
        true,
      );
      expect(
        wrapper.find("[data-testid=onboarding-reverse-proxy]").exists(),
      ).toBe(true);
    });

    it("keeps remote access from whoever may not switch it", async () => {
      grantAllBut(Scope.SYSTEM_MANAGE);

      const wrapper = await mountLoadedStep();

      // the request would only fail at them; the reverse proxy is still theirs
      expect(wrapper.findComponent({ name: "RemoteAccessCard" }).exists()).toBe(
        false,
      );
      expect(
        wrapper.find("[data-testid=onboarding-reverse-proxy]").exists(),
      ).toBe(true);
    });
  });

  describe("the advanced settings", () => {
    it("keeps them folded away, with the form ready underneath", async () => {
      const wrapper = await mountLoadedStep();

      expect(advancedFolded(wrapper)).toBe(true);
      expect(apiMock.getCoreConfig).toHaveBeenCalledWith("webserver");
      expect(apiMock.getCoreConfig).toHaveBeenCalledWith("streams");
      // the settings of both modules, in one form
      expect(
        form(wrapper)
          .props("configEntries")
          .map((configEntry: ConfigEntry) => configEntry.key),
      ).toEqual(["server_name", "base_url", "external_url", "publish_ip"]);
      // the switch above the form is what hides the entries, not the form's
      // own advanced toggle, which it does not offer
      expect(form(wrapper).props("showAdvancedSettings")).toBe(true);
    });

    it("unfolds them on request", async () => {
      const wrapper = await mountLoadedStep();

      await wrapper
        .find("[data-testid=onboarding-advanced-settings]")
        .trigger("click");

      expect(advancedFolded(wrapper)).toBe(false);
    });

    it("unfolds them for the external address", async () => {
      const wrapper = await mountLoadedStep();

      await wrapper
        .find("[data-testid=onboarding-set-external-address]")
        .trigger("click");
      await flushPromises();

      expect(advancedFolded(wrapper)).toBe(false);
    });

    it("keeps them from whoever may not change the settings", async () => {
      grantAllBut(Scope.CONFIG_CORE_WRITE);

      const wrapper = await mountLoadedStep();

      // nothing to unfold, nothing to fetch for it, and nothing to point at
      expect(advancedSection(wrapper).exists()).toBe(false);
      expect(
        wrapper.find("[data-testid=onboarding-set-external-address]").exists(),
      ).toBe(false);
      expect(apiMock.getCoreConfig).not.toHaveBeenCalled();
      await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);
    });

    it("leaves out a setting this server does not carry", async () => {
      apiMock.getCoreConfig.mockImplementation(async (domain) =>
        domain === "webserver"
          ? webserverConfig({ server_name: entry("server_name") })
          : streamsConfig({ bind_port: entry("bind_port") }),
      );

      const wrapper = await mountLoadedStep();

      expect(
        form(wrapper)
          .props("configEntries")
          .map((configEntry: ConfigEntry) => configEntry.key),
      ).toEqual(["server_name"]);
    });

    it("keeps the room and says it is busy while the settings load", async () => {
      apiMock.getCoreConfig.mockImplementation(() => new Promise(() => {}));

      const wrapper = await mountLoadedStep();

      expect(advancedSection(wrapper).find("[role=status]").exists()).toBe(
        true,
      );
      expect(form(wrapper).exists()).toBe(false);
      expect(wrapper.text()).not.toContain(
        "onboarding.steps.core_settings.load_failed",
      );
    });

    it("says so when the settings cannot be loaded", async () => {
      apiMock.getCoreConfig.mockRejectedValue(new Error("boom"));

      const wrapper = await mountLoadedStep();

      // the api toasts its own failures; nothing here is filled in with values
      // nobody stands behind
      expect(form(wrapper).exists()).toBe(false);
      expect(advancedSection(wrapper).find("[role=status]").exists()).toBe(
        false,
      );
      expect(wrapper.text()).toContain(
        "onboarding.steps.core_settings.load_failed",
      );
      expect(warnSpy).toHaveBeenCalledOnce();
    });
  });

  describe("saving", () => {
    it("saves each setting to its own module, and says so once", async () => {
      const values = { server_name: "Living room", publish_ip: "10.0.0.5" };
      const wrapper = await mountLoadedStep();

      await form(wrapper).vm.$emit("submit", values);
      await flushPromises();

      // each module merges what it is handed in, so a subset is safe to send
      expect(apiMock.saveCoreConfig).toHaveBeenCalledTimes(2);
      expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("webserver", {
        server_name: "Living room",
      });
      expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("streams", {
        publish_ip: "10.0.0.5",
      });
      expect(toastMock.success).toHaveBeenCalledOnce();
      expect(toastMock.success).toHaveBeenCalledWith("settings.settings_saved");
      expect(toastMock.error).not.toHaveBeenCalled();
      expect(saveFailed).not.toHaveBeenCalled();
      // the step stays on screen, so the form is told which values the server
      // now has — and only those
      expect(saveSucceeded).toHaveBeenCalledWith(values);
    });

    it("hands a module nothing when none of its settings changed", async () => {
      const wrapper = await mountLoadedStep();

      await form(wrapper).vm.$emit("submit", EDITED_VALUES);
      await flushPromises();

      expect(apiMock.saveCoreConfig).toHaveBeenCalledOnce();
      expect(apiMock.saveCoreConfig).toHaveBeenCalledWith(
        "webserver",
        EDITED_VALUES,
      );
    });

    it("shows and checks the stream server's new address once it has moved", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout"] });
      const wrapper = await mountLoadedStep();

      await form(wrapper).vm.$emit("submit", { publish_ip: "10.0.0.5" });
      await flushPromises();

      // the save has answered, but the stream server restarts only a moment
      // later and says nothing once it is back, so the address is asked again
      expect(apiMock.getStreamServerInfo).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1500);
      await flushPromises();
      expect(apiMock.getStreamServerInfo).toHaveBeenCalledTimes(2);
      // still the old address: not moved yet, so it is asked once more
      expect(addressUrl(wrapper, "stream").text()).toBe(STREAM_URL);

      apiMock.getStreamServerInfo.mockResolvedValue({
        base_url: MOVED_STREAM_URL,
      });
      await vi.advanceTimersByTimeAsync(3000);
      await flushPromises();

      expect(apiMock.getStreamServerInfo).toHaveBeenCalledTimes(3);
      expect(addressUrl(wrapper, "stream").text()).toBe(MOVED_STREAM_URL);
      expect(probedUrls()).toContain(`${MOVED_STREAM_URL}/info`);

      // moved, so it is left alone from here on
      await vi.advanceTimersByTimeAsync(10_000);
      await flushPromises();
      expect(apiMock.getStreamServerInfo).toHaveBeenCalledTimes(3);
    });

    it("keeps asking when a lookup fails while the server restarts", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout"] });
      const wrapper = await mountLoadedStep();

      await form(wrapper).vm.$emit("submit", { publish_ip: "10.0.0.5" });
      await flushPromises();

      // the first lookup lands while the stream server is down: the address
      // shown stays, and the lookup is not the last word
      apiMock.getStreamServerInfo.mockRejectedValueOnce(
        new Error("restarting"),
      );
      await vi.advanceTimersByTimeAsync(1500);
      await flushPromises();
      expect(addressUrl(wrapper, "stream").text()).toBe(STREAM_URL);

      apiMock.getStreamServerInfo.mockResolvedValue({
        base_url: MOVED_STREAM_URL,
      });
      await vi.advanceTimersByTimeAsync(3000);
      await flushPromises();

      expect(apiMock.getStreamServerInfo).toHaveBeenCalledTimes(3);
      expect(addressUrl(wrapper, "stream").text()).toBe(MOVED_STREAM_URL);
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("stops asking for the stream server's address after a while", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout"] });
      const wrapper = await mountLoadedStep();

      await form(wrapper).vm.$emit("submit", { publish_ip: "10.0.0.5" });
      await flushPromises();

      // an address that never moves — the same one saved again, say — is not
      // asked for forever
      await vi.advanceTimersByTimeAsync(30_000);
      await flushPromises();

      expect(apiMock.getStreamServerInfo).toHaveBeenCalledTimes(4);
      expect(addressUrl(wrapper, "stream").text()).toBe(STREAM_URL);
    });

    it("has nothing left to save once the form was saved", async () => {
      hasUnsavedChanges.value = true;

      const wrapper = await mountLoadedStep();

      await form(wrapper).vm.$emit("submit", EDITED_VALUES);
      await flushPromises();

      await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);

      // moving on after a Save does not send the same settings a second time
      expect(apiMock.saveCoreConfig).toHaveBeenCalledOnce();
      expect(toastMock.success).toHaveBeenCalledOnce();
    });

    it("waits for the save the form's own button started", async () => {
      let landSave: (config: CoreConfig) => void = () => {};
      apiMock.saveCoreConfig.mockImplementation(
        () =>
          new Promise((resolve) => {
            landSave = resolve;
          }),
      );
      hasUnsavedChanges.value = true;

      const wrapper = await mountLoadedStep();
      await form(wrapper).vm.$emit("submit", EDITED_VALUES);

      const leaving = wrapper.vm.beforeLeave();
      landSave(webserverConfig());

      await expect(leaving).resolves.toBe(true);
      // one save, whichever of the two asked for it
      expect(apiMock.saveCoreConfig).toHaveBeenCalledOnce();
    });

    it("leaves the edits guarded when a save did not land, and says it once", async () => {
      apiMock.saveCoreConfig.mockRejectedValue(new Error("no such address"));

      const wrapper = await mountLoadedStep();

      await form(wrapper).vm.$emit("submit", EDITED_VALUES);
      await flushPromises();

      // the api tells the user itself, so the step does not say it a second time
      expect(toastMock.error).not.toHaveBeenCalled();
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(saveFailed).toHaveBeenCalledOnce();
    });
  });

  describe("leaving the step", () => {
    it("waits for the settings before it answers the wizard", async () => {
      const handOverConfigs: (() => void)[] = [];
      apiMock.getCoreConfig.mockImplementation(
        (domain) =>
          new Promise((resolve) => {
            handOverConfigs.push(() =>
              resolve(
                domain === "webserver" ? webserverConfig() : streamsConfig(),
              ),
            );
          }),
      );

      const wrapper = mountStep();
      let answered = false;
      const leaving = wrapper.vm.beforeLeave().then((mayLeave) => {
        answered = true;
        return mayLeave;
      });
      await flushPromises();

      // settings the user never saw are not settings they left alone
      expect(answered).toBe(false);

      for (const handOver of handOverConfigs) handOver();
      await expect(leaving).resolves.toBe(true);
    });

    it("lets the wizard move on when there is nothing to save", async () => {
      const wrapper = await mountLoadedStep();

      await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);

      expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
    });

    it("saves the pending edits before the wizard moves on", async () => {
      hasUnsavedChanges.value = true;

      const wrapper = await mountLoadedStep();

      await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);

      expect(apiMock.saveCoreConfig).toHaveBeenCalledWith(
        "webserver",
        EDITED_VALUES,
      );
      expect(toastMock.success).toHaveBeenCalledWith("settings.settings_saved");
    });

    it("keeps the wizard here when the save does not land", async () => {
      hasUnsavedChanges.value = true;
      apiMock.saveCoreConfig.mockRejectedValue(new Error("no such address"));

      const wrapper = await mountLoadedStep();

      await expect(wrapper.vm.beforeLeave()).resolves.toBe(false);

      expect(saveFailed).toHaveBeenCalledOnce();
    });

    it("keeps the wizard here when the form has something to say", async () => {
      hasUnsavedChanges.value = true;
      valuesValidate.value = false;

      const wrapper = await mountLoadedStep();

      // the form holds its values back and shows what is wrong with them, so
      // there is nothing to save and nowhere to go
      await expect(wrapper.vm.beforeLeave()).resolves.toBe(false);

      expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
    });

    it("lets the wizard move on when there is no form at all", async () => {
      apiMock.getCoreConfig.mockRejectedValue(new Error("boom"));

      const wrapper = await mountLoadedStep();

      // settings that could not be loaded are nothing to hold anyone up over
      await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);
    });
  });
});
