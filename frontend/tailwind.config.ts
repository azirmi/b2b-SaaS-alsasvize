import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx,mdx}",
    "./lib/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#23345D",
          secondary: "#A42E49",
          premium: "#CBB074",
          muted: "#F3E6C5",
          base: "#FFFFFF",
        },
        primary: "#23345D",
        secondary: "#A42E49",
      },
    },
  },
};

export default config;
