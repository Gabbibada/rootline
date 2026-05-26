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

// Force Supabase to resolve to its CJS build.
// The ESM build (index.mjs) uses dynamic import(variable) which Hermes
// rejects with "Invalid expression encountered". CJS uses require() which
// Hermes handles fine.
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@supabase/supabase-js') {
    return {
      filePath: require.resolve('@supabase/supabase-js/dist/index.cjs'),
      type: 'sourceFile',
    };
  }
  return (defaultResolver ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
