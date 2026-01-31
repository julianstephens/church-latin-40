/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        red: {
          900: "#8B1538",
          800: "#A11C47",
          700: "#B72B56",
          600: "#CD3A65",
        },
        // Add custom dark theme colors
        dark: {
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
          950: "#030712",
        },
      },
      // Extend default colors for dark mode
      backgroundColor: {
        dark: {
          primary: "#111827",
          secondary: "#1f2937",
          accent: "#374151",
        },
      },
      textColor: {
        dark: {
          primary: "#f9fafb",
          secondary: "#e5e7eb",
          muted: "#9ca3af",
        },
      },
      borderColor: {
        dark: {
          DEFAULT: "#374151",
          light: "#4b5563",
        },
      },
    },
  },
  plugins: [],
  // Add dark mode variants for all utilities
  variants: {
    extend: {
      backgroundColor: ["dark"],
      textColor: ["dark"],
      borderColor: ["dark"],
      ringColor: ["dark"],
      boxShadow: ["dark"],
    },
  },
};
