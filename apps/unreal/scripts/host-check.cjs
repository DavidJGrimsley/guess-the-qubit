// Host verification for Unreal Engine 5.8 development and packaging.
// Detects whether an engine is installed for the current host and whether the project is structurally sound.
// It never compiles, cooks, or runs automation, so it can only report "detected", never "natively validated".
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { verifyStructure } = require('./structural-check.cjs');

const EXPECTED_ENGINE_VERSION = { major: 5, minor: 8 };

// Per-platform engine layout under <EngineRoot>/Engine/Binaries/<binariesDir>.
// Windows is validated on real hardware. The macOS and Linux layouts follow the installed-engine layout and are NOT
// validated on real Mac/Linux hosts from this repository.
const PLATFORM_LAYOUTS = {
  win32: {
    label: 'Windows',
    binariesDir: 'Win64',
    editorCmdCandidates: ['UnrealEditor-Cmd.exe'],
    standardRoots: ['C:\\Program Files\\Epic Games\\UE_5.8'],
    pathApi: path.win32
  },
  darwin: {
    label: 'macOS',
    binariesDir: 'Mac',
    editorCmdCandidates: ['UnrealEditor-Cmd', 'UnrealEditor-Cmd.app/Contents/MacOS/UnrealEditor-Cmd'],
    standardRoots: ['/Users/Shared/Epic Games/UE_5.8'],
    pathApi: path.posix
  },
  linux: {
    label: 'Linux',
    binariesDir: 'Linux',
    editorCmdCandidates: ['UnrealEditor-Cmd'],
    standardRoots: ['/opt/EpicGames/UE_5.8', '/opt/UnrealEngine/UE_5.8'],
    pathApi: path.posix
  }
};

function isEditorCmdName(pathApi, candidate) {
  return /^UnrealEditor-Cmd(\.exe)?$/i.test(pathApi.basename(candidate));
}

function listEditorCmdPaths(layout, root) {
  const { pathApi } = layout;
  const engineDir = pathApi.basename(root) === 'Engine' ? root : pathApi.join(root, 'Engine');
  const binariesDir = pathApi.join(engineDir, 'Binaries', layout.binariesDir);
  return layout.editorCmdCandidates.map((candidate) => pathApi.join(binariesDir, ...candidate.split('/')));
}

// Returns { major, minor, patch } from <EngineRoot>/Engine/Build/Build.version, or null if unavailable.
function readEngineVersion(layout, root, fileSystem) {
  const { pathApi } = layout;
  const engineDir = pathApi.basename(root) === 'Engine' ? root : pathApi.join(root, 'Engine');
  try {
    const parsed = JSON.parse(fileSystem.readFileSync(pathApi.join(engineDir, 'Build', 'Build.version'), 'utf8'));
    if (Number.isInteger(parsed.MajorVersion) && Number.isInteger(parsed.MinorVersion)) {
      return { major: parsed.MajorVersion, minor: parsed.MinorVersion, patch: parsed.PatchVersion };
    }
  } catch {
    // Missing or unreadable Build.version leaves the engine version unverified.
  }
  return null;
}

// Derives <EngineRoot> from a direct path to an editor executable (<root>/Engine/Binaries/<platform>/...).
function inferRootFromEditorCmd(layout, editorCmd) {
  const { pathApi } = layout;
  const parts = pathApi.normalize(editorCmd).split(pathApi.sep);
  const binariesIndex = parts.lastIndexOf('Binaries');
  if (binariesIndex >= 2 && parts[binariesIndex - 1] === 'Engine') {
    return parts.slice(0, binariesIndex - 1).join(pathApi.sep) || pathApi.sep;
  }
  return null;
}

// Resolves the engine editor command line tool for a host.
// options: { platform, env, existsSync, readFileSync } are injectable so every host layout can be tested from any OS.
function resolveEnginePaths(options = {}) {
  const platform = options.platform || os.platform();
  const env = options.env || process.env;
  const fileSystem = {
    existsSync: options.existsSync || fs.existsSync,
    readFileSync: options.readFileSync || fs.readFileSync
  };

  const layout = PLATFORM_LAYOUTS[platform];
  if (!layout) {
    return { root: null, editorCmd: null, platform, unsupportedPlatform: true, version: null };
  }

  const finish = (root, editorCmd) => ({
    root,
    editorCmd,
    platform,
    unsupportedPlatform: false,
    version: root && editorCmd ? readEngineVersion(layout, root, fileSystem) : null
  });

  const overridePath = env.UNREAL_ENGINE_PATH || env.UE_5_8_PATH;
  if (overridePath) {
    // An explicit override never falls back to standard locations.
    if (isEditorCmdName(layout.pathApi, overridePath)) {
      return fileSystem.existsSync(overridePath)
        ? finish(inferRootFromEditorCmd(layout, overridePath), overridePath)
        : finish(overridePath, null);
    }
    const found = listEditorCmdPaths(layout, overridePath).find((candidate) => fileSystem.existsSync(candidate));
    return found ? finish(overridePath, found) : finish(overridePath, null);
  }

  for (const standardRoot of layout.standardRoots) {
    const found = listEditorCmdPaths(layout, standardRoot).find((candidate) => fileSystem.existsSync(candidate));
    if (found) {
      return finish(standardRoot, found);
    }
  }

  return finish(null, null);
}

function runHostCheck(options = {}) {
  const projectRoot = options.projectRoot || path.resolve(__dirname, '..');
  const platform = options.platform || os.platform();
  console.log('--- Guess the Qubit Unreal Host & Project Verification ---');
  console.log(`Host Platform: ${platform} (${options.arch || os.arch()})`);
  console.log(`OS Release:    ${options.release || os.release()}`);

  // 1. Structural check (must pass on any host)
  const structResult = verifyStructure(projectRoot);
  if (!structResult.valid) {
    console.error('FAIL: Static project structure check failed:');
    for (const err of structResult.errors) {
      console.error(`  - ${err}`);
    }
    return { success: false, code: 1, reason: 'structural_failure' };
  }
  console.log('Structural Check: PASSED (all descriptors, configs, plugins verified)');

  // 2. Engine detection. The structural check above stays valid on any host, but native status is separate.
  const engine = options.engineOverride || resolveEnginePaths(options);

  if (engine.unsupportedPlatform) {
    console.warn(`\n[HOST_UNSUPPORTED] ${platform} is not a supported Unreal Engine 5.8 host (supported: Windows, macOS, Linux).`);
    console.warn('No native Unreal validation is possible on this host and none was performed.');
    console.log('--- Unreal Host Check: UNVERIFIED (Unsupported Host) ---\n');
    return { success: false, code: 1, reason: 'unsupported_host', nativeValidated: false };
  }

  if (!engine.editorCmd) {
    console.warn('\n[HOST_UNVERIFIED] Unreal Engine 5.8 was not detected on this machine.');
    console.warn('Set UNREAL_ENGINE_PATH or UE_5_8_PATH to the engine root (the folder containing Engine/) if UE 5.8 is installed elsewhere.');
    console.warn('Native Unreal compilation, cooking, and automation tests require an installed engine.');
    console.log('[NOTICE] JS orchestration scripts verify project descriptors, plugins, and host readiness.');
    console.log('[NOTICE] JS checks do not compile or validate native Unreal C++ or cook UE assets.');
    console.log('--- Unreal Host Check: UNVERIFIED (Missing Native Engine) ---\n');
    return { success: false, code: 1, reason: 'engine_missing', nativeValidated: false };
  }

  const expected = `${EXPECTED_ENGINE_VERSION.major}.${EXPECTED_ENGINE_VERSION.minor}`;
  if (engine.version && (engine.version.major !== EXPECTED_ENGINE_VERSION.major || engine.version.minor !== EXPECTED_ENGINE_VERSION.minor)) {
    console.error(`FAIL: Engine at ${engine.editorCmd} is ${engine.version.major}.${engine.version.minor}, expected ${expected}.`);
    console.log('--- Unreal Host Check: FAILED (Engine Version Mismatch) ---\n');
    return { success: false, code: 1, reason: 'engine_version_mismatch', engine, nativeValidated: false };
  }

  console.log(`Unreal Engine editor CLI: DETECTED at ${engine.editorCmd}`);
  console.log(
    engine.version
      ? `Engine version:          ${engine.version.major}.${engine.version.minor}.${engine.version.patch ?? '?'}`
      : `Engine version:          not verified (Engine/Build/Build.version unreadable; expected ${expected})`
  );
  console.log('\n[NOTICE] Detection only: this check does not compile, cook, package, or run automation.');
  console.log('[NOTICE] Native results come from Build.bat/UAT builds and `pnpm run unreal:test:automation` on this host.');
  console.log('--- Unreal Host Check: ENGINE DETECTED (native build and automation not exercised) ---\n');
  return { success: true, code: 0, engine, nativeValidated: false };
}

if (require.main === module) {
  const isStructuralOnly = process.argv.includes('--structural-only');
  if (isStructuralOnly) {
    const structResult = verifyStructure(path.resolve(__dirname, '..'));
    if (!structResult.valid) {
      process.exit(1);
    }
    process.exit(0);
  }

  const result = runHostCheck();
  process.exit(result.code);
}

module.exports = { runHostCheck, resolveEnginePaths, PLATFORM_LAYOUTS, EXPECTED_ENGINE_VERSION };
