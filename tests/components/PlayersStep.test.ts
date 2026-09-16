// Imported once, outside any test: pulling the empty, item and dialog
// components in is the expensive part, and the import phase is not on a test's
// clock.
import PlayersStep from "@/components/onboarding/steps/PlayersStep.vue";
import type {
  ConfiguredProvider,
  DiscoveredPlayer,
} from "@/composables/useOnboarding";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { authMock, onboardingState, renamePlayer, setPlayerEnabled } =
  vi.hoisted(() => ({
    authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
    // what the composable found, which the step only ever reads
    onboardingState: {
      providers: [] as ConfiguredProvider[],
      players: [] as DiscoveredPlayer[],
    },
    renamePlayer: vi.fn(),
    setPlayerEnabled: vi.fn(),
  }));

vi.mock("@/composables/useOnboarding", () => ({
  configuredProviders: () => onboardingState.providers,
  discoveredPlayers: () => onboardingState.players,
}));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

// the saves are covered where they live; here they only have to be called
vi.mock("@/helpers/player_settings_actions", () => ({
  renamePlayer,
  setPlayerEnabled,
}));

// the icon reaches for artwork and a theme this bare mount does not set up;
// what it stands for is covered where it lives
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: {
    name: "ProviderIcon",
    props: ["domain", "size"],
    template: "<i />",
  },
}));

// the dialog is covered where it lives; here it only has to be reachable and
// to report the props the step hands it
vi.mock("@/views/settings/AddProviderDialog.vue", () => ({
  default: {
    name: "AddProviderDialog",
    props: ["show", "providerType", "multiInstanceOnly", "selfServiceOnly"],
    template: "<div data-testid='add-provider-dialog' />",
  },
}));

function addProvider(overrides: Partial<ConfiguredProvider> = {}) {
  onboardingState.providers.push({
    instance_id: "sonos--1",
    name: "Sonos",
    domain: "sonos",
    needsAttention: false,
    ...overrides,
  });
}

function addPlayer(overrides: Partial<DiscoveredPlayer> = {}) {
  onboardingState.players.push({
    player_id: "kitchen",
    name: "Kitchen",
    customName: null,
    providerLabel: "Sonos",
    enabled: true,
    available: true,
    needsSetup: false,
    icon: null,
    canToggle: true,
    ...overrides,
  });
}

function mountStep() {
  return mount(PlayersStep, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

type Step = ReturnType<typeof mountStep>;

function addButton(wrapper: Step) {
  return wrapper.find("[data-testid=onboarding-add-provider]");
}

function rows(wrapper: Step) {
  return wrapper.findAll("[data-testid=onboarding-player]");
}

/** The rename field, opened the way the user opens it. */
async function startRename(wrapper: Step) {
  await wrapper.find("[data-testid=onboarding-player-rename]").trigger("click");
  await flushPromises();
  return wrapper.find("[data-testid=onboarding-player-name-input]");
}

describe("PlayersStep", () => {
  beforeEach(() => {
    onboardingState.providers = [];
    onboardingState.players = [];
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.admin),
    );
    renamePlayer.mockReset();
    renamePlayer.mockResolvedValue(true);
    setPlayerEnabled.mockReset();
    setPlayerEnabled.mockResolvedValue(true);
  });

  it("explains what finds players when nothing is set up", () => {
    const wrapper = mountStep();

    // with nothing to act on, the description says what finds players
    expect(wrapper.text()).toContain(
      "onboarding.steps.players.description_empty",
    );
    expect(wrapper.text()).toContain("onboarding.steps.players.empty");
    expect(wrapper.text()).toContain(
      "onboarding.steps.players.no_provider_hint",
    );
    // nothing is looking yet, so there is nothing to wait for
    expect(
      wrapper.find("[data-testid=onboarding-players-discovering]").exists(),
    ).toBe(false);
    expect(
      wrapper.findAll("[data-testid=onboarding-player-provider]"),
    ).toHaveLength(0);
    // adding one is the thing to do, so it is the button that stands out
    expect(addButton(wrapper).text()).toBe("settings.add_player_provider");
    expect(addButton(wrapper).classes()).toContain("bg-primary");

    wrapper.unmount();
  });

  it("asks the user to wait once a provider is looking", () => {
    addProvider();

    const wrapper = mountStep();

    expect(wrapper.text()).toContain(
      "onboarding.steps.players.discovering_hint",
    );
    expect(wrapper.text()).not.toContain(
      "onboarding.steps.players.no_provider_hint",
    );
    // a provider that is set up is still looking, and the step shows that
    // rather than an empty list that reads as final
    expect(
      wrapper.find("[data-testid=onboarding-players-discovering]").exists(),
    ).toBe(true);
    // the provider that is set up is in view, so what "add more" adds to is
    // clear and a provider that found nothing yet still shows for its work
    const providers = wrapper.findAll(
      "[data-testid=onboarding-player-provider]",
    );
    expect(providers).toHaveLength(1);
    expect(providers[0].text()).toContain("Sonos");
    expect(addButton(wrapper).text()).toBe("onboarding.steps.players.add_more");
    expect(addButton(wrapper).classes()).toContain("bg-accent");

    wrapper.unmount();
  });

  it("flags a provider that is set up but not doing anything", () => {
    addProvider({ needsAttention: true });
    addProvider({ instance_id: "cast--1", name: "Chromecast", domain: "cast" });

    const wrapper = mountStep();

    const providers = wrapper.findAll(
      "[data-testid=onboarding-player-provider]",
    );
    expect(
      providers[0].find("[aria-label=onboarding\\.needs_attention]").exists(),
    ).toBe(true);
    expect(
      providers[1].find("[aria-label=onboarding\\.needs_attention]").exists(),
    ).toBe(false);

    wrapper.unmount();
  });

  it("lists the players with what they came from", () => {
    addPlayer({ player_id: "kitchen", name: "Kitchen" });
    addPlayer({
      player_id: "study",
      name: "Study",
      providerLabel: "AirPlay, Chromecast",
    });

    const wrapper = mountStep();

    expect(rows(wrapper).map((row) => row.text())).toEqual([
      expect.stringContaining("Kitchen"),
      expect.stringContaining("AirPlay, Chromecast"),
    ]);
    expect(wrapper.text()).not.toContain("onboarding.steps.players.empty");
    // with players to act on, the description says what can be done to them
    expect(wrapper.text()).toContain("onboarding.steps.players.description");
    expect(wrapper.text()).not.toContain(
      "onboarding.steps.players.description_empty",
    );

    wrapper.unmount();
  });

  it("opens the add-a-provider dialog on the player providers", async () => {
    const wrapper = mountStep();

    const dialog = wrapper.findComponent({ name: "AddProviderDialog" });
    expect(dialog.props("show")).toBe(false);

    await addButton(wrapper).trigger("click");

    expect(dialog.props("show")).toBe(true);
    expect(dialog.props("providerType")).toBe(ProviderType.PLAYER);

    wrapper.unmount();
  });

  describe("switching a player on and off", () => {
    it("saves the state the user asked for", async () => {
      addPlayer({ player_id: "kitchen", enabled: true });

      const wrapper = mountStep();
      await wrapper
        .find("[data-testid=onboarding-player-enabled]")
        .trigger("click");

      expect(setPlayerEnabled).toHaveBeenCalledWith("kitchen", false);

      wrapper.unmount();
    });

    it("shows the state the user asked for while it saves, and lets go of it after", async () => {
      addPlayer({ player_id: "kitchen", enabled: true });
      let landSave: (saved: boolean) => void = () => {};
      setPlayerEnabled.mockImplementation(
        () => new Promise<boolean>((resolve) => (landSave = resolve)),
      );

      const wrapper = mountStep();
      const toggle = () =>
        wrapper.find("[data-testid=onboarding-player-enabled]");
      await toggle().trigger("click");

      // off at once, and out of reach until the save answers
      expect(toggle().attributes("aria-checked")).toBe("false");
      expect(toggle().attributes("disabled")).toBeDefined();

      landSave(false);
      await flushPromises();

      // a save that did not land shows the state the list still holds
      expect(toggle().attributes("aria-checked")).toBe("true");
      expect(toggle().attributes("disabled")).toBeUndefined();

      wrapper.unmount();
    });

    it("switches a player that is off back on", async () => {
      addPlayer({ player_id: "kitchen", enabled: false });

      const wrapper = mountStep();
      const row = rows(wrapper)[0];
      await row
        .find("[data-testid=onboarding-player-enabled]")
        .trigger("click");

      expect(setPlayerEnabled).toHaveBeenCalledWith("kitchen", true);
      // a player that is off is still in the list, only greyed out
      expect(row.classes()).toContain("opacity-60");

      wrapper.unmount();
    });

    it("is out of reach for a user who may not change players", () => {
      authMock.hasScope.mockImplementation(
        scopeChecker(BUILTIN_ROLE_SCOPES.user),
      );
      addPlayer();

      const wrapper = mountStep();

      expect(
        wrapper
          .find("[data-testid=onboarding-player-enabled]")
          .attributes("disabled"),
      ).toBeDefined();
      // and nothing to rename with either
      expect(
        wrapper.find("[data-testid=onboarding-player-rename]").exists(),
      ).toBe(false);

      wrapper.unmount();
    });

    it("is out of reach while the player's provider is not running", () => {
      addPlayer({ canToggle: false });

      const wrapper = mountStep();

      // switching it takes its provider, which has to be there to do it
      expect(
        wrapper
          .find("[data-testid=onboarding-player-enabled]")
          .attributes("disabled"),
      ).toBeDefined();

      wrapper.unmount();
    });
  });

  describe("renaming a player", () => {
    it("saves the name the user typed", async () => {
      addPlayer({ player_id: "kitchen", name: "Kitchen" });

      const wrapper = mountStep();
      const input = await startRename(wrapper);

      // the field comes up on the name the player goes by
      expect((input.element as HTMLInputElement).value).toBe("Kitchen");
      // the pencil keeps its place while the field is open, so the switch
      // next to it stays put
      expect(
        wrapper.find("[data-testid=onboarding-player-rename]").classes(),
      ).toContain("invisible");

      await input.setValue("New name");
      await input.trigger("keydown.enter");
      await flushPromises();

      expect(renamePlayer).toHaveBeenCalledWith("kitchen", "New name");
      expect(
        wrapper.find("[data-testid=onboarding-player-name-input]").exists(),
      ).toBe(false);
      expect(
        wrapper.find("[data-testid=onboarding-player-rename]").classes(),
      ).not.toContain("invisible");

      wrapper.unmount();
    });

    it("saves what the user typed when they click away", async () => {
      addPlayer({ player_id: "kitchen" });

      const wrapper = mountStep();
      const input = await startRename(wrapper);
      await input.setValue("New name");
      await input.trigger("blur");
      await flushPromises();

      expect(renamePlayer).toHaveBeenCalledWith("kitchen", "New name");

      wrapper.unmount();
    });

    it("hands a cleared field back to the name the provider reports", async () => {
      addPlayer({ player_id: "kitchen", name: "Attic", customName: "Attic" });

      const wrapper = mountStep();
      const input = await startRename(wrapper);
      await input.setValue("  ");
      await input.trigger("keydown.enter");
      await flushPromises();

      expect(renamePlayer).toHaveBeenCalledWith("kitchen", null);

      wrapper.unmount();
    });

    it("saves nothing when the name is left as it was", async () => {
      addPlayer({ player_id: "kitchen", name: "Kitchen" });

      const wrapper = mountStep();
      const input = await startRename(wrapper);
      await input.trigger("keydown.enter");
      await flushPromises();

      expect(renamePlayer).not.toHaveBeenCalled();
      expect(
        wrapper.find("[data-testid=onboarding-player-name-input]").exists(),
      ).toBe(false);

      wrapper.unmount();
    });

    it("drops what was typed when the user presses escape", async () => {
      addPlayer({ player_id: "kitchen" });

      const wrapper = mountStep();
      const input = await startRename(wrapper);
      await input.setValue("New name");
      await input.trigger("keydown.esc");
      await flushPromises();

      expect(renamePlayer).not.toHaveBeenCalled();
      expect(
        wrapper.find("[data-testid=onboarding-player-name-input]").exists(),
      ).toBe(false);

      wrapper.unmount();
    });

    it("keeps the field open when the save does not land", async () => {
      addPlayer({ player_id: "kitchen" });
      renamePlayer.mockResolvedValue(false);

      const wrapper = mountStep();
      const input = await startRename(wrapper);
      await input.setValue("New name");
      await input.trigger("keydown.enter");
      await flushPromises();

      // so the user can try again or leave it, instead of losing what they typed
      expect(renamePlayer).toHaveBeenCalledOnce();
      expect(
        wrapper.find("[data-testid=onboarding-player-name-input]").exists(),
      ).toBe(true);

      wrapper.unmount();
    });
  });

  describe("what a row says about a player", () => {
    it("says a player still has to be set up", () => {
      addPlayer({ needsSetup: true, available: false });

      const wrapper = mountStep();

      // its setup is why it is not reachable, so that is what the row says
      expect(
        wrapper.find("[aria-label=settings\\.player_needs_setup]").exists(),
      ).toBe(true);
      expect(
        wrapper.find("[aria-label=settings\\.player_not_available]").exists(),
      ).toBe(false);

      wrapper.unmount();
    });

    it("says a player that is switched on is not reachable", () => {
      addPlayer({ available: false });

      const wrapper = mountStep();

      expect(
        wrapper.find("[aria-label=settings\\.player_not_available]").exists(),
      ).toBe(true);

      wrapper.unmount();
    });

    it("says nothing of the sort about a player that is switched off", () => {
      addPlayer({ enabled: false, available: false, needsSetup: true });

      const wrapper = mountStep();

      // a player that is off is never reachable, which is nothing to report
      expect(
        wrapper.find("[aria-label=settings\\.player_not_available]").exists(),
      ).toBe(false);
      expect(
        wrapper.find("[aria-label=settings\\.player_needs_setup]").exists(),
      ).toBe(false);

      wrapper.unmount();
    });
  });
});
