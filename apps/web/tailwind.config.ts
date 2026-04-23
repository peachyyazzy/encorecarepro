import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9ecff",
          500: "#1f6feb",
          600: "#1158c7",
          700: "#0d47a3",
        },
      },
    },
  },
  plugins: [],
};

export default config;
