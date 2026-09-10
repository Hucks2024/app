import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdf6",
          100: "#dcfce9",
          200: "#bbf7d4",
          300: "#86efb3",
          400: "#4ade8a",
          500: "#22c368",
          600: "#16a352",
          700: "#158043",
          800: "#166538",
          900: "#145330",
          950: "#0b3220",
        },
        // Every existing text-slate-*/bg-slate-*/border-slate-* utility in
        // the app (there are a lot, scattered across every page) keeps
        // working as-is, but each shade now resolves through a CSS
        // variable instead of a fixed value. globals.css sets the
        // light-mode values on :root and flips them (roughly mirrored,
        // 50<->900, 100<->800, etc.) under .dark, so the whole existing
        // app becomes dark-mode-aware from one place rather than needing
        // dark: variants hand-added to every element.
        slate: {
          50: "rgb(var(--slate-50) / <alpha-value>)",
          100: "rgb(var(--slate-100) / <alpha-value>)",
          200: "rgb(var(--slate-200) / <alpha-value>)",
          300: "rgb(var(--slate-300) / <alpha-value>)",
          400: "rgb(var(--slate-400) / <alpha-value>)",
          500: "rgb(var(--slate-500) / <alpha-value>)",
          600: "rgb(var(--slate-600) / <alpha-value>)",
          700: "rgb(var(--slate-700) / <alpha-value>)",
          800: "rgb(var(--slate-800) / <alpha-value>)",
          900: "rgb(var(--slate-900) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
export default config;
