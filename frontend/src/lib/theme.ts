// Single source of truth for the dashboard palette.
// Hex values mirror the HSL CSS vars in src/index.css and the
// Tailwind theme in tailwind.config.ts. Use these constants only
// where Tailwind utilities cannot reach: SVG fill/stroke attributes,
// computed colors with alpha, dynamic gradients.

export const palette = {
  paper: "#F1ECDF",
  card: "#F7F3E6",
  ink: "#1F2925",
  inkSoft: "#5C6660",
  faint: "#D6CFB8",
  rule: "#A89D7C",
  hot: "#B0563A",
  cold: "#3F6B6B",
  sage: "#7A8868",
  mute: "#B8AE8C",
  highlight: "#E5C26B",
} as const;

export type PaletteColor = (typeof palette)[keyof typeof palette];
