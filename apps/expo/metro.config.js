const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts = [
  ...new Set([...config.resolver.assetExts, 'glb', 'gltf', 'bin', 'obj', 'mtl', 'vrx']),
];

// Avoid crawling Unreal Engine assets and generated build trees in monorepo
const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
    ? [config.resolver.blockList]
    : [];

config.resolver.blockList = [
  ...defaultBlockList,
  /.*[/\\]apps[/\\]unreal[/\\].*/,
  /.*[/\\](?:Intermediate|Binaries|Saved|DerivedDataCache|Builds)[/\\].*/,
];

module.exports = config;
