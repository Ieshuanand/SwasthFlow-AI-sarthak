import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        medical: {
          slate: "#5b7b94",
          "slate-dark": "#435d72",
          "slate-light": "#8fa8bd",
          powder: "#eef4f8",
          navy: "#0f172a",
          teal: "#0d9488",
          coral: "#ea580c",
        },
      },
    },
  },
  plugins: [],
};
export default config;
