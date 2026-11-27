// What the app's version code (runtimeVersion, fingerprint policy) is made from. Silent updates only reach builds
// with the same code. The commands in package.json run on our Mac and never ship inside the app, so changing one
// (for example the platforms update:live sends to) must not split installed builds from new updates.
/** @type {import('expo/fingerprint').Config} */
const config = {
  sourceSkips: ["PackageJsonAndroidAndIosScriptsIfNotContainRun", "PackageJsonScriptsAll"],
};

module.exports = config;
