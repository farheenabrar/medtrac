import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        clinical: {
          primary: "#2563eb",
          "primary-hover": "#1d4ed8",
          "primary-surface": "#eff6ff",
          optimal: "#059669",
          "optimal-surface": "#ecfdf5",
          "optimal-border": "#a7f3d0",
          amber: "#d97706",
          "amber-surface": "#fffbeb",
          "amber-border": "#fde68a",
          rose: "#e11d48",
          "rose-surface": "#fff1f2",
          "rose-border": "#fecdd3",
          violet: "#7c3aed",
          "violet-surface": "#f5f3ff",
          "violet-border": "#ddd6fe",
          ink: "#090d16",
        },
      },
      boxShadow: {
        "clinical-card": "0 2px 12px rgba(0, 0, 0, 0.04)",
        "clinical-card-hover": "0 8px 24px rgba(0, 0, 0, 0.06)",
        "clinical-glass": "0 8px 32px rgba(15, 23, 42, 0.05)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
