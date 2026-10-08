import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Readable on a phone by anyone: nothing smaller than 14px, small
      // print at 16px, and normal text at 17px, the iPhone's own default.
      // Tailwind's stock 12px/14px were the sizes people squinted at.
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.25rem" }],
        sm: ["1rem", { lineHeight: "1.5rem" }],
        base: ["1.0625rem", { lineHeight: "1.625rem" }],
      },
      colors: {
        // Violet, the colour of the nav, the pins and the app icon (see
        // BRAND in src/components/Logo.tsx). This used to be a green from
        // when the app was only about running, which left every button and
        // link a different colour from everything around it.
        brand: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
        // Every text-slate-*/bg-slate-*/border-slate-* utility in the app
        // (there are a lot, scattered across every page) keeps working
        // as-is, but each shade resolves through a CSS variable instead of
        // a fixed value, set once on :root in globals.css. One place to
        // retune the greys for the whole app.
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
