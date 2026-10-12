const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// inlineRem: 16 per React Native Reusables docs, so rem-based classes resolve to 16px.
const withStyles = withNativeWind(config, { input: "./global.css", inlineRem: 16 });

// The shared package is TypeScript that imports its own files as "./auth.js" (the Node way).
// Metro looks for a real .js file, so for files in /packages/ we retry without the extension.
const resolveRequest = withStyles.resolver.resolveRequest;
withStyles.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = resolveRequest ?? context.resolveRequest;
  if (moduleName.startsWith(".") && moduleName.endsWith(".js") && context.originModulePath.includes("/packages/")) {
    try {
      return resolve(context, moduleName.slice(0, -3), platform);
    } catch {
      // Fall through to the normal lookup.
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = withStyles;
