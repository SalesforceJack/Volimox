import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        canvas: {
          DEFAULT: "hsl(var(--canvas))",
          muted: "hsl(var(--canvas-muted))",
        },
        ink: {
          DEFAULT: "hsl(var(--ink))",
          muted: "hsl(var(--ink-muted))",
          faint: "hsl(var(--ink-faint))",
        },
        line: {
          DEFAULT: "hsl(var(--line))",
          strong: "hsl(var(--line-strong))",
        },
        signal: "hsl(var(--signal))",
        background: "hsl(0 0% 3.9%)",
        foreground: "hsl(0 0% 98%)",
        card: {
          DEFAULT: "hsl(0 0% 3.9%)",
          foreground: "hsl(0 0% 98%)",
        },
        muted: {
          DEFAULT: "hsl(0 0% 14.9%)",
          foreground: "hsl(0 0% 63.9%)",
        },
        primary: {
          DEFAULT: "hsl(0 0% 98%)",
          foreground: "hsl(0 0% 9%)",
        },
        secondary: {
          DEFAULT: "hsl(0 0% 14.9%)",
          foreground: "hsl(0 0% 98%)",
        },
        destructive: {
          DEFAULT: "hsl(0 62.8% 30.6%)",
          foreground: "hsl(0 0% 98%)",
        },
        border: "hsl(0 0% 14.9%)",
        input: "hsl(0 0% 14.9%)",
        ring: "hsl(0 0% 83.1%)",
        accent: {
          DEFAULT: "hsl(0 0% 14.9%)",
          foreground: "hsl(0 0% 98%)",
        },
        popover: {
          DEFAULT: "hsl(0 0% 3.9%)",
          foreground: "hsl(0 0% 98%)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
