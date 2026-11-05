const { getDefaultConfig } = require('expo/metro-config');
const {
  createUnrealBlockPattern,
  getUnrealDirectory,
} = require('./tools/metro/unreal-block-list.cjs');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts = [
  ...new Set([...config.resolver.assetExts, 'glb', 'gltf', 'bin', 'obj', 'mtl', 'vrx']),
];

// Avoid crawling the sibling Unreal project (assets and generated build trees) in the monorepo.
// Scoped to this repository's apps/unreal so checkouts under directories named Builds or Saved still resolve.
const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
    ? [config.resolver.blockList]
    : [];

config.resolver.blockList = [
  ...defaultBlockList,
  createUnrealBlockPattern(getUnrealDirectory(__dirname)),
];

module.exports = config;
