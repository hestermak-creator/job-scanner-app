import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "#e5e5e0",
        muted: "#8a8a84",
        accent: "#185fa5"
      }
    }
  },
  plugins: []
};

export default config;
