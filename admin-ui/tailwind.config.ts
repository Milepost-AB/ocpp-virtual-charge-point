import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214, 32%, 91%)",
        input: "hsl(214, 32%, 91%)",
        ring: "hsl(214, 100%, 45%)",
        background: "hsl(210, 20%, 98%)",
        foreground: "hsl(222, 47%, 12%)",
        primary: {
          DEFAULT: "hsl(222, 47%, 11%)",
          foreground: "hsl(210, 20%, 99%)",
        },
        secondary: {
          DEFAULT: "hsl(210, 16%, 93%)",
          foreground: "hsl(222, 47%, 12%)",
        },
        muted: {
          DEFAULT: "hsl(210, 16%, 95%)",
          foreground: "hsl(215, 16%, 45%)",
        },
        accent: {
          DEFAULT: "hsl(160, 84%, 39%)",
          foreground: "hsl(210, 20%, 99%)",
        },
        destructive: {
          DEFAULT: "hsl(0, 72%, 51%)",
          foreground: "hsl(210, 20%, 98%)",
        },
      },
      borderRadius: {
        lg: "12px",
        md: "10px",
        sm: "8px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.2s ease-in",
      },
    },
  },
  plugins: [],
};

export default config;

