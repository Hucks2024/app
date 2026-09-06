import type { Config } from "tailwindcss";

const config: Config = {
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
        },
      },
    },
  },
  plugins: [],
};
export default config;
