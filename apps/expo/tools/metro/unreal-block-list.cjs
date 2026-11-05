/* Metro must not crawl the sibling Unreal project (apps/unreal): it holds large binary assets and generated
 * Binaries/Intermediate/Saved/DerivedDataCache trees that Expo never imports.
 * The pattern is anchored to the actual Unreal directory of this checkout. Generic directory-name patterns would also
 * match ancestors of the checkout (for example a CI workspace under /srv/Builds or C:\Saved) and hide the whole app.
 */
const path = require('node:path');

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Matches the Unreal directory itself and everything under it. Separators match either style so Windows paths with
// forward slashes (and POSIX paths) are handled; Windows paths are also matched case-insensitively.
function createUnrealBlockPattern(unrealDirectory) {
  const isWindowsPath = /^[A-Za-z]:[\\/]|^\\\\/.test(unrealDirectory);
  const trimmed = unrealDirectory.replace(/[\\/]+$/, '');
  const source = trimmed.split(/[\\/]+/).map(escapeRegExp).join('[\\\\/]');
  return new RegExp(`^${source}(?:[\\\\/]|$)`, isWindowsPath ? 'i' : '');
}

function getUnrealDirectory(expoProjectRoot) {
  return path.resolve(expoProjectRoot, '..', 'unreal');
}

module.exports = { createUnrealBlockPattern, getUnrealDirectory };
