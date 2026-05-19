import { ref } from "vue";

export function useSmartPlaylistYearRange() {
  const yearFromEl = ref<HTMLInputElement | null>(null);
  const yearToEl = ref<HTMLInputElement | null>(null);

  function getYearFromInput(): number | undefined {
    const v = yearFromEl.value?.value.trim() ?? "";
    const n = parseInt(v);
    return v && !isNaN(n) ? n : undefined;
  }

  function getYearToInput(): number | undefined {
    const v = yearToEl.value?.value.trim() ?? "";
    const n = parseInt(v);
    return v && !isNaN(n) ? n : undefined;
  }

  function onYearFromInput(): number | undefined {
    return getYearFromInput();
  }

  function onYearToInput(): number | undefined {
    return getYearToInput();
  }

  function clearYear(): void {
    if (yearFromEl.value) yearFromEl.value.value = "";
    if (yearToEl.value) yearToEl.value.value = "";
  }

  return {
    yearFromEl,
    yearToEl,
    onYearFromInput,
    onYearToInput,
    clearYear,
    getYearFromInput,
    getYearToInput,
  };
}
