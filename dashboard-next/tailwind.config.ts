import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#0B1215",
        paper: "#F9F8F7",
        azure: "#0080FE",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "Consolas", "monospace"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px #0080FE, 0 0 10px #0080FE" },
          "100%": { boxShadow: "0 0 10px #0080FE, 0 0 20px #0080FE, 0 0 30px #0080FE" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
