export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Modern 2026 palette with WCAG 2.1 compliance
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c2d6b",
        },
        accent: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#145231",
        },
      },
      backgroundImage: {
        "gradient-hero": "linear-gradient(135deg, #0ea5e9 0%, #6d28d9 100%)",
        "gradient-subtle": "linear-gradient(135deg, #f0f9ff 0%, #f5f3ff 100%)",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 8px rgba(0, 0, 0, 0.08)",
        medium: "0 4px 16px rgba(0, 0, 0, 0.1)",
        elevated: "0 8px 32px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
}
