const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// inlineRem: 16 per React Native Reusables docs, so rem-based classes resolve to 16px.
module.exports = withNativeWind(config, { input: "./global.css", inlineRem: 16 });
