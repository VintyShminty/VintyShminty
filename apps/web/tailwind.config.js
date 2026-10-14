const { extend, cssVariablesPlugin } = require("@vinty/design/tailwind");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend },
  plugins: [cssVariablesPlugin],
};
