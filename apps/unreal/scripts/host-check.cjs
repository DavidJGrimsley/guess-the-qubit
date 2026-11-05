// Host verification for Unreal Engine 5.8 development and packaging
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { verifyStructure } = require('./structural-check.cjs');

function resolveEnginePaths() {
  const envPath = process.env.UNREAL_ENGINE_PATH || process.env.UE_5_8_PATH;
  if (envPath) {
    const candidateCmd = path.join(envPath, 'Engine', 'Binaries', os.platform() === 'win32' ? 'Win64\\UnrealEditor-Cmd.exe' : 'UnrealEditor-Cmd');
    const directCmd = envPath.endsWith('UnrealEditor-Cmd.exe') || envPath.endsWith('UnrealEditor-Cmd') ? envPath : candidateCmd;
    if (fs.existsSync(directCmd)) {
      return { root: envPath, editorCmd: directCmd };
    }
    // Explicit override path specified but not found on disk: do not fall back
    return { root: envPath, editorCmd: null };
  }

  const platform = os.platform();
  if (platform === 'win32') {
    const standardRoot = 'C:\\Program Files\\Epic Games\\UE_5.8';
    const standardCmd = path.join(standardRoot, 'Engine', 'Binaries', 'Win64', 'UnrealEditor-Cmd.exe');
    if (fs.existsSync(standardCmd)) {
      return { root: standardRoot, editorCmd: standardCmd };
    }
  } else if (platform === 'darwin') {
    const standardRoot = '/Users/Shared/Epic Games/UE_5.8';
    const standardCmd = path.join(standardRoot, 'Engine', 'Binaries', 'Mac', 'UnrealEditor-Cmd');
    if (fs.existsSync(standardCmd)) {
      return { root: standardRoot, editorCmd: standardCmd };
    }
  } else if (platform === 'linux') {
    const standardRoot = '/opt/EpicGames/UE_5.8';
    const standardCmd = path.join(standardRoot, 'Engine', 'Binaries', 'Linux', 'UnrealEditor-Cmd');
    if (fs.existsSync(standardCmd)) {
      return { root: standardRoot, editorCmd: standardCmd };
    }
  }

  return { root: null, editorCmd: null };
}

function runHostCheck(options = {}) {
  const projectRoot = options.projectRoot || path.resolve(__dirname, '..');
  console.log('--- Guess the Qubit Unreal Host & Project Verification ---');
  console.log(`Host Platform: ${os.platform()} (${os.arch()})`);
  console.log(`OS Release:    ${os.release()}`);

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

  // 2. Native Engine Check
  const engine = resolveEnginePaths();
  if (!engine.editorCmd) {
    console.warn('\n[HOST_UNVERIFIED] Unreal Engine 5.8 was not detected on this machine.');
    console.warn('Set UNREAL_ENGINE_PATH or UE_5_8_PATH if UE 5.8 is installed in a non-standard location.');
    console.warn('Native Unreal compilation, cooking, and automation tests require an installed engine.');
    console.log('[NOTICE] JS orchestration scripts verify project descriptors, plugins, and host readiness.');
    console.log('[NOTICE] JS checks do not compile or validate native Unreal C++ or cook UE assets.');
    console.log('--- Unreal Host Check: UNVERIFIED (Missing Native Engine) ---\n');
    return { success: false, code: 1, reason: 'engine_missing' };
  }

  console.log(`Unreal Engine 5.8: FOUND at ${engine.editorCmd}`);
  console.log('\n[NOTICE] JS orchestration scripts verify project descriptors, plugins, and host readiness.');
  console.log('[NOTICE] JS checks do not compile or validate native Unreal C++ or cook UE assets.');
  console.log('--- Unreal Host Verification Passed (Native Engine Present) ---\n');
  return { success: true, code: 0, engine };
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

module.exports = { runHostCheck, resolveEnginePaths };
