const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");
const convexRoot = path.resolve(monorepoRoot, "convex");

const config = getDefaultConfig(projectRoot);

// Convex lives at monorepo root - Metro must watch it for symlink resolution
config.watchFolders = [...(config.watchFolders ?? []), convexRoot];
config.resolver = {
  ...config.resolver,
  unstable_enableSymlinks: true,
};

module.exports = withNativeWind(config, { input: "./global.css", inlineRem: 16 });
