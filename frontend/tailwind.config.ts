import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const hsl = (token: string) => `hsl(var(--${token}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dashboard palette — semantic names match src/lib/theme.ts.
        paper: hsl("paper"),
        ink: { DEFAULT: hsl("ink"), soft: hsl("ink-soft") },
        faint: hsl("faint"),
        rule: hsl("rule"),
        hot: hsl("hot"),
        cold: hsl("cold"),
        sage: hsl("sage"),
        mute: hsl("mute"),
        highlight: hsl("highlight"),

        // shadcn semantic tokens.
        accent: {
          DEFAULT: hsl("accent"),
          foreground: hsl("accent-foreground"),
        },
        surface: hsl("surface"),
        background: hsl("background"),
        foreground: hsl("foreground"),
        muted: { DEFAULT: hsl("muted"), foreground: hsl("muted-foreground") },
        border: hsl("border"),
        ring: hsl("ring"),
        card: { DEFAULT: hsl("card"), foreground: hsl("card-foreground") },
        destructive: {
          DEFAULT: hsl("destructive"),
          foreground: hsl("destructive-foreground"),
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
        display: ["'Inter Tight'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
