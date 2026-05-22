// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const engineRoot  = path.resolve(projectRoot, '../engine');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Watch the local engine package for changes
config.watchFolders = [engineRoot];

// Enable symlink resolution (npm file: deps are symlinked)
config.resolver.unstable_enableSymlinks = true;

// Explicit fallback: point the package name straight at the built dist
config.resolver.extraNodeModules = {
  '@rootline/engine': engineRoot,
};

module.exports = config;
