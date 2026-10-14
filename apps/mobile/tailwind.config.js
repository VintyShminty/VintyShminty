const { extend, cssVariablesPlugin } = require("@vinty/design/tailwind");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: { extend },
  plugins: [require("tailwindcss-animate"), cssVariablesPlugin],
};
