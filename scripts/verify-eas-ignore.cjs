// Offline simulation test for root .easignore rules.
// This is a local approximation of gitignore-style matching (comments, negation, directory, basename and extension
// patterns). It is NOT the EAS CLI matcher: it makes no cloud calls and cannot prove what `eas build` would upload.
// It guards that Unreal assets, caches, and secrets stay excluded while monorepo manifests and Expo files are retained.
// Real archive confirmation needs `eas build:inspect` with an authenticated EAS account and a linked project.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function parseIgnoreFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const rules = [];
  for (let line of content.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const isNegative = line.startsWith('!');
    if (isNegative) line = line.slice(1).trim();
    rules.push({ pattern: line, isNegative });
  }
  return rules;
}

function matchRule(filepath, rule) {
  const normalized = filepath.replace(/\\/g, '/').replace(/^\//, '');
  const basename = path.basename(normalized);
  let p = rule.pattern.replace(/\\/g, '/');

  // Directory wildcard ending in /**
  if (p.endsWith('/**')) {
    const dir = p.slice(0, -3);
    if (normalized.startsWith(dir + '/')) return true;
  }
  // Directory ending in /
  if (p.endsWith('/')) {
    const dir = p.slice(0, -1);
    if (normalized === dir || normalized.startsWith(dir + '/')) return true;
  }
  // Prefix wildcard **/
  if (p.startsWith('**/')) {
    const name = p.slice(3);
    if (normalized.endsWith(name) || normalized.includes('/' + name) || basename === name) return true;
  }
  // Extension wildcard *.ext
  if (p.startsWith('*.')) {
    const ext = p.slice(1);
    if (normalized.endsWith(ext)) return true;
  }
  // If pattern has no slash, match basename or full path
  if (!p.includes('/')) {
    if (p.includes('*')) {
      const regex = new RegExp('^' + p.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      if (regex.test(basename)) return true;
    } else if (basename === p) {
      return true;
    }
  }

  // Exact match or directory prefix match
  if (normalized === p || normalized.startsWith(p + '/')) return true;

  return false;
}

function isIgnored(filepath, rules) {
  let ignored = false;
  for (const rule of rules) {
    if (matchRule(filepath, rule)) {
      ignored = !rule.isNegative;
    }
  }
  return ignored;
}

console.log('--- Offline EAS Ignore Pattern Simulation ---');
const easIgnorePath = path.resolve(__dirname, '../.easignore');
assert.ok(fs.existsSync(easIgnorePath), 'Expected root .easignore to exist');
const rules = parseIgnoreFile(easIgnorePath);

const testCases = [
  // Must be IGNORED
  { path: 'apps/unreal/Content/Main_Level.umap', expected: true, reason: 'Unreal level map must be excluded' },
  { path: 'apps/unreal/GuessTheQubit.uproject', expected: true, reason: 'Unreal project file must be excluded' },
  { path: 'apps/unreal/Binaries/Win64/UnrealEditor.dll', expected: true, reason: 'Unreal binaries must be excluded' },
  { path: 'apps/unreal/Intermediate/Build.log', expected: true, reason: 'Unreal intermediate files must be excluded' },
  { path: 'apps/unreal/Plugins/QuantumAPI/QuantumApi.uplugin', expected: true, reason: 'Unreal plugin must be excluded' },
  { path: 'apps/unreal/Saved/Logs/GuessTheQubit.log', expected: true, reason: 'Unreal saved logs must be excluded' },
  { path: 'apps/unreal/Config/DefaultGame.local.ini', expected: true, reason: 'Unreal local ini must be excluded' },
  { path: '.turbo/cache/test.tar.zst', expected: true, reason: 'Turbo cache must be excluded' },
  { path: '.env', expected: true, reason: 'Private .env must be excluded' },
  { path: '.env.local', expected: true, reason: 'Private .env.* must be excluded' },
  { path: 'credentials.json', expected: true, reason: 'Credentials must be excluded' },

  // Must NOT be ignored (must be RETAINED in archive)
  { path: 'package.json', expected: false, reason: 'Root package.json must be retained' },
  { path: 'pnpm-workspace.yaml', expected: false, reason: 'Root workspace configuration must be retained' },
  { path: 'pnpm-lock.yaml', expected: false, reason: 'Root pnpm lockfile must be retained' },
  { path: 'patches/decode-uri-component@0.5.0.patch', expected: false, reason: 'pnpm patch file must be retained' },
  { path: 'apps/expo/metro.config.js', expected: false, reason: 'Metro config must be retained' },
  { path: 'apps/expo/tools/metro/unreal-block-list.cjs', expected: false, reason: 'Metro helper must be retained' },
  { path: 'apps/expo/package.json', expected: false, reason: 'Expo package.json must be retained' },
  { path: 'apps/expo/app.json', expected: false, reason: 'Expo app.json must be retained' },
  { path: 'apps/expo/src/app/index.tsx', expected: false, reason: 'Expo application source must be retained' },
  { path: 'apps/expo/.env.example', expected: false, reason: '.env.example must be retained' }
];

let failed = 0;
for (const tc of testCases) {
  const actual = isIgnored(tc.path, rules);
  if (actual !== tc.expected) {
    console.error(`FAIL: ${tc.path} -> expected ignored=${tc.expected}, got ${actual} (${tc.reason})`);
    failed++;
  } else {
    console.log(`PASS: [${actual ? 'IGNORED' : 'RETAINED'}] ${tc.path}`);
  }
}

if (failed > 0) {
  console.error(`EAS ignore simulation failed with ${failed} mismatches.`);
  process.exit(1);
} else {
  console.log(`--- All ${testCases.length} EAS ignore simulation cases passed ---\n`);
}
