import QueueBookmarkRow from "@/layouts/default/PlayerOSD/QueueBookmarkRow.vue";
import type { MediaItemBookmark } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

// the menu rendered in place, so its items can be clicked
vi.mock("@/components/ui/dropdown-menu", () => {
  const passthrough = { template: "<div><slot /></div>" };
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuContent: passthrough,
    DropdownMenuSeparator: passthrough,
    DropdownMenuItem: {
      emits: ["click"],
      template:
        '<button type="button" @click="$emit(\'click\')"><slot /></button>',
    },
  };
});

const bookmark: MediaItemBookmark = {
  name: "Arrakis",
  start: 754,
  provider_instance: "audiobookshelf--1",
  item_id: "book1",
  stored_by_music_assistant: false,
};

function mountRow(editable: boolean) {
  return mount(QueueBookmarkRow, {
    props: { bookmark, time: 754, editable, inChapter: true },
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("QueueBookmarkRow", () => {
  it("shows the name and position, and jumps there", async () => {
    const wrapper = mountRow(false);

    expect(wrapper.get(".queue-chapter__name").text()).toBe("Arrakis");
    expect(wrapper.get(".queue-chapter__time").text()).toBe("12:34");
    await wrapper.get('[data-testid="queue-bookmark"]').trigger("click");
    expect(wrapper.emitted("seek")).toHaveLength(1);
    // nothing to edit, so no menu
    expect(wrapper.find('[data-testid="queue-bookmark-menu"]').exists()).toBe(
      false,
    );
  });

  it("renames or deletes it from its menu", async () => {
    const wrapper = mountRow(true);

    await wrapper.get('[data-testid="queue-bookmark-rename"]').trigger("click");
    await wrapper.get('[data-testid="queue-bookmark-delete"]').trigger("click");

    expect(wrapper.emitted("rename")).toHaveLength(1);
    expect(wrapper.emitted("remove")).toHaveLength(1);
  });
});
