import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#fff8ed",
          100: "#ffefd4",
          200: "#ffdca9",
          300: "#ffc272",
          400: "#ff9d3b",
          500: "#ff7d15",
          600: "#f0630b",
          700: "#c74a0b",
          800: "#9e3b12",
          900: "#7f3212",
          950: "#451706",
        },
        ink: {
          50: "#f6f6f5",
          100: "#e7e6e2",
          200: "#d0ccc3",
          300: "#aea79a",
          400: "#8c8375",
          500: "#736a5c",
          600: "#5b5448",
          700: "#47423a",
          800: "#3a352f",
          900: "#2a2622",
          950: "#1a1815",
        },
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulsebar: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        bounceIn: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.1)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "marquee-slow": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "gradient-mesh": {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(3%,-2%) scale(1.05)" },
          "66%": { transform: "translate(-2%,3%) scale(0.97)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        spinslow: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out",
        pulsebar: "pulsebar 1.6s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
        "bounce-in": "bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        marquee: "marquee 28s linear infinite",
        "marquee-slow": "marquee-slow 50s linear infinite",
        "gradient-mesh": "gradient-mesh 18s ease-in-out infinite",
        float: "float 5s ease-in-out infinite",
        spinslow: "spinslow 18s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
