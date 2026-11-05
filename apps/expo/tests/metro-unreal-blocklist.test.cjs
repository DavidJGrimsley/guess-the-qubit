const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const {
  createUnrealBlockPattern,
  getUnrealDirectory,
} = require('../tools/metro/unreal-block-list.cjs');

const blocked = (pattern, file) => pattern.test(file);

test('Windows checkout: blocks apps\\unreal (either separator, either drive-letter case) but not the Expo app', () => {
  const pattern = createUnrealBlockPattern('C:\\src\\guess-the-qubit\\apps\\unreal');
  for (const file of [
    'C:\\src\\guess-the-qubit\\apps\\unreal',
    'C:\\src\\guess-the-qubit\\apps\\unreal\\Content\\Main_Level.umap',
    'C:\\src\\guess-the-qubit\\apps\\unreal\\Intermediate\\Build\\Win64\\x.cpp',
    'C:/src/guess-the-qubit/apps/unreal/Saved/Logs/a.log',
    'c:\\src\\guess-the-qubit\\apps\\unreal\\Binaries\\Win64\\GuessTheQubit.exe',
  ]) {
    assert.equal(blocked(pattern, file), true, file);
  }
  for (const file of [
    'C:\\src\\guess-the-qubit\\apps\\expo\\src\\app\\index.tsx',
    'C:\\src\\guess-the-qubit\\apps\\expo\\node_modules\\expo\\package.json',
    'C:\\src\\guess-the-qubit\\apps\\unreal-tools\\script.js',
    'C:\\src\\guess-the-qubit\\patches\\decode-uri-component@0.5.0.patch',
  ]) {
    assert.equal(blocked(pattern, file), false, file);
  }
});

test('POSIX checkout: blocks apps/unreal but not the Expo app', () => {
  const pattern = createUnrealBlockPattern('/home/runner/work/guess-the-qubit/apps/unreal');
  for (const file of [
    '/home/runner/work/guess-the-qubit/apps/unreal',
    '/home/runner/work/guess-the-qubit/apps/unreal/Content/Main_Level.umap',
    '/home/runner/work/guess-the-qubit/apps/unreal/DerivedDataCache/x.ddp',
  ]) {
    assert.equal(blocked(pattern, file), true, file);
  }
  for (const file of [
    '/home/runner/work/guess-the-qubit/apps/expo/src/app/index.tsx',
    '/home/runner/work/guess-the-qubit/apps/unreal-tools/script.js',
    '/home/runner/work/guess-the-qubit/apps/unreal.md',
    // POSIX paths are case-sensitive.
    '/home/runner/work/guess-the-qubit/apps/Unreal/Content/a.umap',
  ]) {
    assert.equal(blocked(pattern, file), false, file);
  }
});

test('ancestors named Builds, Saved, Binaries, Intermediate or apps/unreal never hide the Expo app', () => {
  const cases = [
    {
      unreal: 'C:\\Builds\\Saved\\guess-the-qubit\\apps\\unreal',
      expoFile: 'C:\\Builds\\Saved\\guess-the-qubit\\apps\\expo\\src\\app\\index.tsx',
      unrealFile: 'C:\\Builds\\Saved\\guess-the-qubit\\apps\\unreal\\Content\\Main_Level.umap',
    },
    {
      unreal: '/srv/Builds/Binaries/Intermediate/DerivedDataCache/guess-the-qubit/apps/unreal',
      expoFile:
        '/srv/Builds/Binaries/Intermediate/DerivedDataCache/guess-the-qubit/apps/expo/src/app/index.tsx',
      unrealFile:
        '/srv/Builds/Binaries/Intermediate/DerivedDataCache/guess-the-qubit/apps/unreal/Content/a.uasset',
    },
    {
      // The checkout itself lives below a directory called apps/unreal.
      unreal: '/work/apps/unreal/guess-the-qubit/apps/unreal',
      expoFile: '/work/apps/unreal/guess-the-qubit/apps/expo/src/app/index.tsx',
      unrealFile: '/work/apps/unreal/guess-the-qubit/apps/unreal/Content/a.uasset',
    },
  ];
  for (const { unreal, expoFile, unrealFile } of cases) {
    const pattern = createUnrealBlockPattern(unreal);
    assert.equal(blocked(pattern, expoFile), false, expoFile);
    assert.equal(blocked(pattern, unrealFile), true, unrealFile);
  }
});

test('paths with regular-expression metacharacters are matched literally', () => {
  const pattern = createUnrealBlockPattern('/work/(a+b)[1]/guess.the.qubit/apps/unreal');
  assert.equal(blocked(pattern, '/work/(a+b)[1]/guess.the.qubit/apps/unreal/Content/a'), true);
  assert.equal(blocked(pattern, '/work/aab1/guessXtheXqubit/apps/unreal/Content/a'), false);
});

test('metro.config.js blocks the real apps/unreal directory and keeps the Expo project crawlable', () => {
  const config = require('../metro.config.js');
  const expoRoot = path.resolve(__dirname, '..');
  const unrealRoot = getUnrealDirectory(expoRoot);
  assert.equal(unrealRoot, path.resolve(expoRoot, '..', 'unreal'));

  const patterns = [].concat(config.resolver.blockList);
  const isBlocked = (file) => patterns.some((pattern) => pattern.test(file));

  assert.equal(isBlocked(unrealRoot), true);
  assert.equal(isBlocked(path.join(unrealRoot, 'Content', 'Main_Level.umap')), true);
  assert.equal(isBlocked(path.join(unrealRoot, 'Intermediate', 'Build', 'x.cpp')), true);
  assert.equal(isBlocked(path.join(expoRoot, 'src', 'app', 'index.tsx')), false);
  assert.equal(isBlocked(path.join(expoRoot, 'metro.config.js')), false);
  // The default Expo block list must still be present.
  assert.ok(patterns.length >= 2);
});

test('every blockList pattern shares the same RegExp flags (Expo CLI refuses to combine mixed flags)', () => {
  const patterns = [].concat(require('../metro.config.js').resolver.blockList);
  const flags = new Set(patterns.map((pattern) => pattern.flags));
  assert.equal(flags.size, 1, `mixed flags: ${[...flags].map((flag) => `"${flag}"`).join(', ')}`);
  // Regression: a Windows-only "i" flag made `expo export` fail with "Cannot combine blockList patterns".
  assert.equal(createUnrealBlockPattern('C:\\src\\repo\\apps\\unreal').flags, '');
  assert.equal(createUnrealBlockPattern('/src/repo/apps/unreal').flags, '');
});

test('Expo CLI composes the real blockList into one pattern that still blocks only apps/unreal', () => {
  const {
    composeMetroIgnorePatterns,
  } = require('@expo/cli/build/src/utils/composeMetroIgnorePatterns');
  const config = require('../metro.config.js');
  const expoRoot = path.resolve(__dirname, '..');
  const unrealRoot = getUnrealDirectory(expoRoot);

  // This is the exact call that threw for mixed flags during `expo export`.
  const combined = composeMetroIgnorePatterns(config.resolver.blockList);
  assert.equal(combined.test(unrealRoot), true);
  assert.equal(combined.test(path.join(unrealRoot, 'Intermediate', 'Build', 'x.cpp')), true);
  assert.equal(combined.test(path.join(expoRoot, 'src', 'app', 'index.tsx')), false);
  assert.equal(combined.test(path.join(expoRoot, 'metro.config.js')), false);
});
