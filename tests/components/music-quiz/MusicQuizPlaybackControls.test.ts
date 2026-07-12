import MusicQuizPlaybackControls from "@/components/music-quiz/MusicQuizPlaybackControls.vue";
import type { MusicQuizPlaybackOptions } from "@/composables/useMusicQuiz";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

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

describe("MusicQuizPlaybackControls", () => {
  it("provides responsive, labelled radio and speaker controls", () => {
    const wrapper = mountControls();
    const radioGroup = wrapper.get('[data-slot="radio-group"]');
    const speaker = wrapper.get("#music-quiz-venue-player");

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
      "providers.music_quiz.speaker",
    );
    expect(speaker.classes()).toContain("w-full");
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(2);
    wrapper.unmount();
  });

  it("keeps one keyboard focus target and retains the Venue speaker", async () => {
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
    expect(
      wrapper.get<HTMLSelectElement>("#music-quiz-venue-player").element.value,
    ).toBe("living-room");
    wrapper.unmount();
  });
});

function mountControls() {
  return mount(
    defineComponent({
      components: { MusicQuizPlaybackControls },
      setup() {
        const selection = ref({
          mode: "venue" as const,
          venuePlayerId: "living-room",
        });
        return { options: PLAYBACK_OPTIONS, selection };
      },
      template: `
        <MusicQuizPlaybackControls
          v-model="selection"
          :options="options"
          :loading="false"
          :disabled="false"
        />
      `,
    }),
    { attachTo: document.body },
  );
}

async function flushKeyboardSelection() {
  await nextTick();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  await flushPromises();
}
