/* Metro must not crawl the sibling Unreal project (apps/unreal): it holds large binary assets and generated
 * Binaries/Intermediate/Saved/DerivedDataCache trees that Expo never imports.
 * The pattern is anchored to the actual Unreal directory of this checkout. Generic directory-name patterns would also
 * match ancestors of the checkout (for example a CI workspace under /srv/Builds or C:\Saved) and hide the whole app.
 *
 * The pattern deliberately carries no RegExp flags: Expo CLI merges every blockList pattern into one RegExp and throws
 * when the patterns have different flags, so a case-insensitive flag here would break `expo export` and `expo start`.
 */
const path = require('node:path');

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Matches the Unreal directory itself and everything under it. Separators match either style so Windows paths with
// forward slashes (and POSIX paths) are handled, and a Windows drive letter matches in either case. The rest of the
// path is matched exactly as Metro derives it from this checkout's location.
function createUnrealBlockPattern(unrealDirectory) {
  const trimmed = unrealDirectory.replace(/[\\/]+$/, '');
  const source = trimmed
    .split(/[\\/]+/)
    .map((segment, index) =>
      index === 0 && /^[A-Za-z]:$/.test(segment)
        ? `[${segment[0].toLowerCase()}${segment[0].toUpperCase()}]:`
        : escapeRegExp(segment)
    )
    .join('[\\\\/]');
  return new RegExp(`^${source}(?:[\\\\/]|$)`);
}

function getUnrealDirectory(expoProjectRoot) {
  return path.resolve(expoProjectRoot, '..', 'unreal');
}

module.exports = { createUnrealBlockPattern, getUnrealDirectory };
