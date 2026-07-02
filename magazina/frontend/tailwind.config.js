/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4F6F3",
        ink: "#182420",
        pine: {
          50: "#EDF5F0", 100: "#D5E8DD", 500: "#1F6F54",
          600: "#175C45", 700: "#114A38", 900: "#0B2E23"
        },
        amber: { 100: "#FDF0D3", 500: "#DFA321", 700: "#8A6210" },
        brick: { 100: "#FBE3DE", 500: "#C4452F", 700: "#8F2F1F" }
      },
      fontFamily: {
        display: ["Archivo", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(24,36,32,.06), 0 4px 16px rgba(24,36,32,.05)"
      }
    }
  },
  plugins: []
};
