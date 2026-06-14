import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          dark: "var(--primary-dark)",
          light: "var(--primary-light)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          dark: "var(--secondary-dark)",
          light: "var(--secondary-light)",
          foreground: "var(--secondary-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          dark: "var(--accent-dark)",
          light: "var(--accent-light)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        border: "var(--border)",
        "border-dark": "var(--border-dark)",
        input: "var(--input)",
        ring: "var(--ring)",
        success: "var(--success)",
        yellow: {
          DEFAULT: "var(--yellow)",
          dark: "var(--yellow-dark)",
        },
        pink: {
          DEFAULT: "var(--pink)",
          dark: "var(--pink-dark)",
        },
        info: {
          DEFAULT: "var(--info)",
          dark: "var(--info-dark)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        ink: {
          1: "var(--text-1)",
          2: "var(--text-2)",
          3: "var(--text-3)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      fontFamily: {
        heading: ["var(--font-nunito)", "sans-serif"],
        body: ["var(--font-jakarta)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-deep": "var(--shadow-card-deep)",
        "btn-primary": "0 4px 0 var(--primary-dark)",
        "btn-primary-pressed": "0 1px 0 var(--primary-dark)",
        "btn-secondary": "0 4px 0 var(--secondary-dark)",
        "btn-secondary-pressed": "0 1px 0 var(--secondary-dark)",
        "btn-accent": "0 4px 0 var(--accent-dark)",
        "btn-accent-pressed": "0 1px 0 var(--accent-dark)",
        "btn-yellow": "0 4px 0 var(--yellow-dark)",
        "btn-yellow-pressed": "0 1px 0 var(--yellow-dark)",
        "btn-outline": "0 3px 0 var(--border-dark)",
        "btn-outline-pressed": "0 0px 0 var(--border-dark)",
      },
      keyframes: {
        "bounce-in": {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "60%": { transform: "scale(1.05)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        breathing: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-3px)" },
        },
        "pet-bounce": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-6px) rotate(-4deg)" },
        },
        ripple: {
          "0%": { transform: "scale(0)", opacity: "0.5" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },
        "xp-glow": {
          "0%, 100%": { boxShadow: "0 0 4px rgba(76,175,80,0.4)" },
          "50%": { boxShadow: "0 0 16px rgba(76,175,80,0.9)" },
        },
        sparkle: {
          "0%": { transform: "scale(0.3) rotate(0deg)", opacity: "0" },
          "50%": { transform: "scale(1.2) rotate(180deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(360deg)", opacity: "1" },
        },
        "coin-fall": {
          "0%": { transform: "translateY(-10vh) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(110vh) rotate(360deg)", opacity: "0" },
        },
        "streak-pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.35)" },
          "100%": { transform: "scale(1)" },
        },
        "float-cloud": {
          "0%": { transform: "translateX(-20vw)" },
          "100%": { transform: "translateX(120vw)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.2", transform: "scale(0.9)" },
          "50%": { opacity: "1", transform: "scale(1.1)" },
        },
        "rainbow-text": {
          "0%, 100%": { color: "#FF6B35" },
          "20%": { color: "#FFD93D" },
          "40%": { color: "#4CAF50" },
          "60%": { color: "#2196F3" },
          "80%": { color: "#7C3AED" },
        },
        "celebrate-pop": {
          "0%": { transform: "scale(0.4) rotate(-15deg)", opacity: "0" },
          "60%": { transform: "scale(1.2) rotate(8deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
      },
      animation: {
        "bounce-in": "bounce-in 0.4s ease-out",
        breathing: "breathing 3s ease-in-out infinite",
        "pet-bounce": "pet-bounce 2s ease-in-out infinite",
        ripple: "ripple 0.3s ease-out",
        "xp-glow": "xp-glow 1.5s ease-in-out infinite",
        sparkle: "sparkle 1.2s ease-out",
        "coin-fall": "coin-fall 1.2s ease-in forwards",
        "streak-pop": "streak-pop 0.4s ease-out",
        "float-cloud": "float-cloud 70s linear infinite",
        "float-cloud-slow": "float-cloud 100s linear infinite",
        twinkle: "twinkle 2.5s ease-in-out infinite",
        "rainbow-text": "rainbow-text 1.5s linear infinite",
        "celebrate-pop": "celebrate-pop 0.5s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
