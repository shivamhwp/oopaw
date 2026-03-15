const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Follow symlinks (convex/_generated -> root convex/_generated)
config.resolver.unstable_enableSymlinks = true;

// Watch the monorepo root so Metro can resolve the symlink target
config.watchFolders = [monorepoRoot];

// Only resolve node_modules from mobile and root — not sibling apps
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Exclude sibling apps from Metro's search
config.resolver.blockList = [/apps\/web\/.*/];

module.exports = withNativewind(config, {
  inlineVariables: false,
});
