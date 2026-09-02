import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#152238",
        forestInk: "#132b29",
        mint: "#47b894",
        mist: "#f4fffb"
      }
    }
  },
  plugins: []
};

export default config;
