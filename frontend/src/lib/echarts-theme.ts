import { palette } from "@/lib/theme";

// Shared visual language for every ECharts instance in the app.
// Centralizes fonts, colors, and axis style so charts feel like one set
// of instruments rather than ten unrelated graphs.

const MONO = "'JetBrains Mono', monospace";

export const chartFonts = {
  mono: MONO,
} as const;

export const monoText = {
  fontFamily: MONO,
  fontSize: 10,
  color: palette.inkSoft,
} as const;

export const monoTextSm = {
  fontFamily: MONO,
  fontSize: 9,
  color: palette.inkSoft,
} as const;

export const axisLine = {
  lineStyle: { color: palette.faint },
} as const;

export const splitLine = {
  show: true,
  lineStyle: { color: palette.faint, type: "dashed" as const },
} as const;

export const tooltipBase = {
  backgroundColor: palette.card,
  borderColor: palette.rule,
  textStyle: {
    color: palette.ink,
    fontSize: 11,
    fontFamily: MONO,
  },
} as const;
