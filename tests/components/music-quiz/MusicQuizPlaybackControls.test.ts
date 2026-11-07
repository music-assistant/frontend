import MusicQuizPlaybackControls from "@/components/music-quiz/MusicQuizPlaybackControls.vue";
import type { MusicQuizPlaybackOptions } from "@/composables/music-quiz/useMusicQuiz";
import api from "@/plugins/api";
import type { Player } from "@/plugins/api/interfaces";
import { webPlayer } from "@/plugins/web_player";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

const PLAYBACK_OPTIONS = {
  default_playback_mode: "venue",
  default_venue_player_id: "living-room",
  venue_available: true,
  remote_available: true,
  venue_players: [
    { player_id: "living-room", name: "Living Room" },
    { player_id: "kitchen", name: "Kitchen" },
  ],
} satisfies MusicQuizPlaybackOptions;

const LAPTOP = { player_id: "laptop", name: "Marcel's Mac (Chrome)" };

describe("MusicQuizPlaybackControls", () => {
  afterEach(() => {
    webPlayer.player_id = null;
    delete api.players[LAPTOP.player_id];
  });

  it("provides responsive, labelled radio and player controls", () => {
    const wrapper = mountControls();
    const fieldSet = wrapper.get('[data-slot="field-set"]');
    const radioGroup = wrapper.get('[data-slot="radio-group"]');
    const player = wrapper.get("#music-quiz-venue-player");

    expect(fieldSet.classes()).toEqual(
      expect.arrayContaining(["m-0", "min-w-0", "border-0", "p-0"]),
    );
    expect(radioGroup.classes()).toEqual(
      expect.arrayContaining(["grid", "sm:grid-cols-2"]),
    );
    expect(
      wrapper.get('label[for="music-quiz-playback-venue"]').text(),
    ).toContain("providers.music_quiz.playback_venue");
    expect(
      wrapper.get('label[for="music-quiz-playback-remote"]').text(),
    ).toContain("providers.music_quiz.playback_remote");
    expect(wrapper.get('label[for="music-quiz-venue-player"]').text()).toBe(
      "providers.music_quiz.player",
    );
    expect(player.classes()).toContain("w-full");
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(2);
    wrapper.unmount();
  });

  it("keeps one keyboard focus target and retains the Venue player", async () => {
    const wrapper = mountControls();
    const radioGroup = wrapper.get<HTMLElement>('[role="radiogroup"]');
    const venue = wrapper.get<HTMLElement>("#music-quiz-playback-venue");

    await flushPromises();
    expect(radioGroup.attributes("tabindex")).toBe("0");
    radioGroup.element.focus();
    await flushPromises();

    const remote = wrapper.get<HTMLElement>("#music-quiz-playback-remote");
    expect(venue.attributes("tabindex")).toBe("0");
    expect(remote.attributes("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(venue.element);

    await venue.trigger("keydown", { key: "ArrowRight" });
    await flushKeyboardSelection();

    expect(
      wrapper.get("#music-quiz-playback-remote").attributes("aria-checked"),
    ).toBe("true");
    expect(remote.attributes("tabindex")).toBe("0");
    expect(wrapper.find("#music-quiz-venue-player").exists()).toBe(false);

    expect(document.activeElement).toBe(remote.element);
    await remote.trigger("keyup", { key: "ArrowRight" });
    await remote.trigger("keydown", { key: "ArrowLeft" });
    await flushKeyboardSelection();

    expect(
      wrapper.get("#music-quiz-playback-venue").attributes("aria-checked"),
    ).toBe("true");
    expect(wrapper.get("#music-quiz-venue-player").text()).toBe("Living Room");
    wrapper.unmount();
  });

  it("marks the selected player of this device", () => {
    webPlayer.player_id = LAPTOP.player_id;
    api.players[LAPTOP.player_id] = {
      player_id: LAPTOP.player_id,
      output_protocols: [],
    } as unknown as Player;
    const wrapper = mountControls(
      {
        ...PLAYBACK_OPTIONS,
        venue_players: [...PLAYBACK_OPTIONS.venue_players, LAPTOP],
      },
      LAPTOP.player_id,
    );

    const trigger = wrapper.get("#music-quiz-venue-player");
    expect(trigger.text()).toContain(LAPTOP.name);
    expect(trigger.get(".player-device-badge-label").text()).toBe(
      "this_device",
    );
    expect(
      wrapper.find('[data-testid="music-quiz-play-on-this-device"]').exists(),
    ).toBe(false);
    wrapper.unmount();
  });

  it("stops switching to this device when the host picks a mode", async () => {
    const wrapper = mountControls();
    const playHere = wrapper.get<HTMLButtonElement>(
      '[data-testid="music-quiz-play-on-this-device"]',
    );

    await playHere.trigger("click");
    expect(playHere.element.disabled).toBe(true);

    await wrapper.get("#music-quiz-playback-remote").trigger("click");
    await flushPromises();
    expect(
      wrapper.get("#music-quiz-playback-remote").attributes("aria-checked"),
    ).toBe("true");
    expect(playHere.element.disabled).toBe(false);
    wrapper.unmount();
  });
});

function mountControls(
  options: MusicQuizPlaybackOptions = PLAYBACK_OPTIONS,
  venuePlayerId = "living-room",
) {
  return mount(
    defineComponent({
      components: { MusicQuizPlaybackControls },
      setup() {
        const selection = ref({
          mode: "venue" as const,
          venuePlayerId,
        });
        return { options, selection };
      },
      template: `
        <MusicQuizPlaybackControls
          v-model="selection"
          :options="options"
          :loading="false"
          :error="false"
          :disabled="false"
        />
      `,
    }),
    {
      attachTo: document.body,
      // PlayerDeviceBadge uses the global $t
      global: { mocks: { $t: (key: string) => key } },
    },
  );
}

async function flushKeyboardSelection() {
  await nextTick();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  await flushPromises();
}
