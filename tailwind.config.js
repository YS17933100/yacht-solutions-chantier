/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#F5F7FA",
        paper: "#FFFFFF",
        ink: "#1E2D4E",
        inktext: "#1E2D4E",
        border: "#D0D8E8",
        borderlight: "#E8EDF5",
        muted: "#7A8BA8",
        mutedtext: "#4A5F80",
        terracotta: "#D63B2F",
        terracottadark: "#B83228",
        forest: "#1E2D4E",
        ocean: "#2B4C8C",
        gold: "#7A8BA8",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};
