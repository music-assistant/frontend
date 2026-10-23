import type {
  ChartTypeRegistry,
  TooltipOptions,
  TooltipCallbacks,
} from "chart.js";

/**
 * Shared Chart.js configuration for Music Assistant styling.
 */

// Music Assistant chart color palette.
export const CHART_COLORS = [
  "#03a9f4", // MA Primary Blue
  "#4caf50", // Green
  "#9c27b0", // Purple
  "#ff9800", // Orange
  "#00bcd4", // Cyan
  "#e91e63", // Pink
  "#3f51b5", // Indigo
  "#8bc34a", // Light Green
  "#ffc107", // Amber
  "#009688", // Teal
];

// Shared tooltip configuration.
export const createTooltipConfig = <
  T extends keyof ChartTypeRegistry = keyof ChartTypeRegistry,
>(
  customCallbacks?: Partial<TooltipCallbacks<T>>,
) => {
  const config: Partial<TooltipOptions<T>> = {
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    titleColor: "#fff",
    bodyColor: "#fff",
    borderWidth: 0,
    padding: 16,
    displayColors: false,
  };

  if (customCallbacks) {
    config.callbacks = customCallbacks as TooltipCallbacks<T>;
  }

  return config;
};

// Shared axis configuration.
export const createAxisConfig = (
  axis: "x" | "y",
  foregroundColor: string,
  isDark: boolean,
) => ({
  ticks: {
    color: foregroundColor,
    font: {
      size: 11,
      family: "system-ui, -apple-system, sans-serif",
    },
  },
  grid: {
    color: isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.12)",
    display: axis === "x",
  },
});
