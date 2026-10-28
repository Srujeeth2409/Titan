/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border, 240 3.7% 15.9%))",
        input: "hsl(var(--input, 240 3.7% 15.9%))",
        ring: "hsl(var(--ring, 240 4.9% 83.9%))",
        background: "hsl(var(--background, 222 47% 7%))",
        foreground: "hsl(var(--foreground, 0 0% 98%))",
        primary: {
          DEFAULT: "hsl(var(--primary, 217 91% 60%))",
          foreground: "hsl(var(--primary-foreground, 0 0% 100%))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary, 217 19% 27%))",
          foreground: "hsl(var(--secondary-foreground, 0 0% 98%))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive, 0 62.8% 30.6%))",
          foreground: "hsl(var(--destructive-foreground, 0 0% 98%))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted, 217 33% 17%))",
          foreground: "hsl(var(--muted-foreground, 215 20.2% 65.1%))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent, 217 33% 17%))",
          foreground: "hsl(var(--accent-foreground, 0 0% 98%))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover, 222 47% 11%))",
          foreground: "hsl(var(--popover-foreground, 0 0% 98%))",
        },
        card: {
          DEFAULT: "hsl(var(--card, 222 47% 11%))",
          foreground: "hsl(var(--card-foreground, 0 0% 98%))",
        },
      },
      borderRadius: {
        lg: "var(--radius, 0.75rem)",
        md: "calc(var(--radius, 0.75rem) - 2px)",
        sm: "calc(var(--radius, 0.75rem) - 4px)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "zoom-in-95": {
          from: { transform: "scale(0.95)" },
          to: { transform: "scale(1)" },
        },
        "zoom-in-90": {
          from: { transform: "scale(0.90)" },
          to: { transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "zoom-in-95": "zoom-in-95 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        "zoom-in-90": "zoom-in-90 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
